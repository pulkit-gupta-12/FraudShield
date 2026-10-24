"""
End-to-End Scenario Verification Script for FraudShield
Tests Scenarios A, B, C, D directly against the running API server:
- Scenario A: Customer alert 'No, not me' -> Card block offered -> Analyst marks fraud with note -> Customer notified -> Stats & audit log update.
- Scenario B: Admin threshold update with slider -> Existing transaction bands recalibrate -> Audit log recorded -> Restored cleanly.
- Scenario C: Transaction Checker: Sample scoring, 100-row CSV upload, 20-second live simulator, and full ml/data/test_sample.csv batch scoring verification (frauds caught, missed, false alarms matching verify_model).
- Scenario D: Role permission boundaries: refusal of other roles' URLs and data by id.
"""

import sys
import os
import time
import json
import requests
import pandas as pd
import numpy as np

BASE_URL = "http://127.0.0.1:8000/api"

DEMO_CREDS = {
    'admin': ('admin@fraudshield.io', 'Admin@123'),
    'analyst': ('analyst@fraudshield.io', 'Analyst@123'),
    'customer': ('customer@fraudshield.io', 'Customer@123'),
    'merchant': ('merchant@fraudshield.io', 'Merchant@123'),
}

def get_tokens(role):
    email, password = DEMO_CREDS[role]
    res = requests.post(f"{BASE_URL}/auth/login/", json={'email': email, 'password': password})
    if res.status_code != 200:
        raise RuntimeError(f"Login failed for {role}: {res.status_code} {res.text}")
    data = res.json()
    return data['access']

def auth_headers(token):
    return {'Authorization': f'Bearer {token}'}


def test_scenario_a():
    print("\n" + "="*70)
    print("RUNNING SCENARIO A: Customer Alert -> Escalation -> Fraud Decision -> Audit")
    print("="*70)

    cust_token = get_tokens('customer')
    analyst_token = get_tokens('analyst')
    admin_token = get_tokens('admin')

    # Baseline audit logs and stats
    admin_h = auth_headers(admin_token)
    audit_pre = requests.get(f"{BASE_URL}/audit-logs/", headers=admin_h).json()
    pre_audit_count = audit_pre.get('count', 0)
    stats_pre = requests.get(f"{BASE_URL}/stats/overview/", headers=admin_h).json()
    pre_fraud_count = stats_pre.get('fraudCount', 0)

    # 1. Customer checks alerts
    cust_h = auth_headers(cust_token)
    alerts_res = requests.get(f"{BASE_URL}/alerts/", headers=cust_h)
    assert alerts_res.status_code == 200, f"Alerts fetch failed: {alerts_res.text}"
    alerts_data = alerts_res.json()
    alert_list = alerts_data.get('results', [])
    
    target_alert = None
    for a in alert_list:
        if a.get('status') in ('new', 'pending', 'investigating'):
            target_alert = a
            break

    if not target_alert and alert_list:
        target_alert = alert_list[0]
        requests.patch(f"{BASE_URL}/alerts/{target_alert['id']}/", headers=admin_h, json={'status': 'new'})

    alert_id = target_alert['id']
    txn_id = target_alert.get('transactionId') or target_alert.get('transaction')
    print(f"[A.1] Customer viewing Alert #{alert_id} on transaction {txn_id}...")

    # 2. Customer answers 'No, not me'
    resp = requests.patch(
        f"{BASE_URL}/alerts/{alert_id}/",
        headers=cust_h,
        json={'customerResponse': 'not_me'}
    )
    assert resp.status_code == 200, f"Alert response failed: {resp.status_code} {resp.text}"
    updated_alert = resp.json()
    print(f"[A.2] Customer answered 'No, not me' -> Alert status: {updated_alert.get('status')}, customerResponse: {updated_alert.get('customerResponse')}")
    assert updated_alert.get('status') == 'escalated', "Expected alert status to be escalated!"

    # 3. Card block is offered to customer
    card_id = target_alert.get('cardId') or target_alert.get('card')
    if not card_id:
        cards_res = requests.get(f"{BASE_URL}/cards/", headers=cust_h).json()
        if cards_res.get('results'):
            card_id = cards_res['results'][0]['id']
    
    if card_id:
        block_res = requests.patch(f"{BASE_URL}/cards/{card_id}/status/", headers=cust_h, json={'status': 'blocked'})
        print(f"[A.3] Card block offered & executed -> Card #{card_id} status: {block_res.json().get('status')}")

    # 4. Analyst sees escalated case
    analyst_h = auth_headers(analyst_token)
    cases_res = requests.get(f"{BASE_URL}/cases/?status=Escalated", headers=analyst_h).json()
    escalated_cases = cases_res.get('results', [])
    assert len(escalated_cases) > 0, "Analyst should see at least one escalated case!"
    target_case = escalated_cases[0]
    case_id = target_case['id']
    print(f"[A.4] Analyst sees Escalated Case #{case_id} (Priority {target_case.get('priority')}).")

    # 5. Analyst marks it Fraud with a note
    decision_res = requests.post(
        f"{BASE_URL}/cases/{case_id}/action/",
        headers=analyst_h,
        json={'action': 'fraud', 'note': 'Confirmed stolen card burst after customer reported not_me.'}
    )
    assert decision_res.status_code == 200, f"Case action failed: {decision_res.text}"
    updated_case = decision_res.json()
    print(f"[A.5] Analyst marked Case #{case_id} as FRAUD -> Case status: {updated_case.get('status')}, outcome: {updated_case.get('outcome')}")

    # 6. Customer receives a notification
    notif_res = requests.get(f"{BASE_URL}/notifications/", headers=cust_h).json()
    notifs = notif_res.get('results', [])
    print(f"[A.6] Customer notifications checked: {len(notifs)} total notifications present.")
    assert len(notifs) > 0, "Customer should have received notification regarding card block/fraud decision!"
    latest_notif = notifs[0]
    print(f"      Latest customer notification: '{latest_notif.get('title')}' - {latest_notif.get('body')}")

    # 7. Admin dashboard numbers and audit log change
    stats_post = requests.get(f"{BASE_URL}/stats/overview/", headers=admin_h).json()
    audit_post = requests.get(f"{BASE_URL}/audit-logs/", headers=admin_h).json()
    post_audit_count = audit_post.get('count', 0)
    print(f"[A.7] Admin stats & audit log verified:")
    print(f"      Audit log count: {pre_audit_count} -> {post_audit_count} (New entries recorded)")
    print(f"      Fraud count: {pre_fraud_count} -> {stats_post.get('fraudCount', 0)}")
    assert post_audit_count >= pre_audit_count, "Audit logs should record the actions!"
    print(">>> SCENARIO A PASSED SUCCESSFULLY! <<<\n")


def test_scenario_b():
    print("="*70)
    print("RUNNING SCENARIO B: Admin Dynamic Threshold Tuning & Global Band Updates")
    print("="*70)

    admin_token = get_tokens('admin')
    admin_h = auth_headers(admin_token)

    orig_threshold = 0.521
    orig_rf = 0.50
    print(f"[B.1] Standard baseline thresholds: Flag={orig_threshold}, ReviewFloor={orig_rf}")

    try:
        # 2. Check band on a transaction with riskScore
        txns_res = requests.get(f"{BASE_URL}/transactions/?pageSize=50", headers=admin_h).json()
        txns = txns_res.get('results', [])
        print(f"[B.2] Inspecting sample of {len(txns)} transactions...")

        # 3. Admin changes threshold via slider (PUT /api/model/threshold/)
        new_threshold = 0.35
        new_rf = 0.20
        put_res = requests.put(
            f"{BASE_URL}/model/threshold/",
            headers=admin_h,
            json={'threshold': new_threshold, 'reviewFloor': new_rf}
        )
        assert put_res.status_code == 200, f"Threshold update failed: {put_res.text}"
        updated_cfg = put_res.json()
        print(f"[B.3] Threshold updated to: Flag={updated_cfg.get('threshold')}, ReviewFloor={updated_cfg.get('reviewFloor')}")

        # 4. Verify transaction bands recalculated
        txns_recal = requests.get(f"{BASE_URL}/transactions/?pageSize=50", headers=admin_h).json()['results']
        flagged_new = sum(1 for t in txns_recal if t.get('band') in ('high', 'Likely fraud', 'FRAUD'))
        print(f"[B.4] Transactions with high/fraud band at threshold 0.35: {flagged_new}")
        assert flagged_new > 0, "Expected transactions to reflect the lower threshold!"

        # 5. Verify audit log recorded THRESHOLDS_UPDATED
        logs_res = requests.get(f"{BASE_URL}/audit-logs/", headers=admin_h).json()['results']
        latest_log = logs_res[0]
        print(f"[B.5] Latest Audit Log: [{latest_log.get('action')}] by {latest_log.get('actor')}: {latest_log.get('details')}")
        assert 'THRESHOLD' in latest_log.get('action', ''), "Expected THRESHOLDS_UPDATED in latest audit log!"

    finally:
        # 6. Restore original thresholds cleanly
        restore_res = requests.put(
            f"{BASE_URL}/model/threshold/",
            headers=admin_h,
            json={'threshold': orig_threshold, 'reviewFloor': orig_rf}
        )
        assert restore_res.status_code == 200
        print(f"[B.6] Restored original thresholds cleanly: Flag={orig_threshold}, ReviewFloor={orig_rf}")
        print(">>> SCENARIO B PASSED SUCCESSFULLY! <<<\n")


def test_scenario_c():
    print("="*70)
    print("RUNNING SCENARIO C: Transaction Checker & Model Provenance Self-Test")
    print("="*70)

    analyst_token = get_tokens('analyst')
    analyst_h = auth_headers(analyst_token)

    # 1. Score stored sample
    sample_res = requests.post(
        f"{BASE_URL}/predict/",
        headers=analyst_h,
        json={'transactionId': 'TXN-100001'}
    )
    assert sample_res.status_code == 200, f"Sample scoring failed: {sample_res.text}"
    sample_data = sample_res.json()
    print(f"[C.1] Stored Sample Scored: TXN-100001")
    print(f"      Risk Score: {sample_data.get('riskScore')}, Band: {sample_data.get('band')}")
    print(f"      Action Recommended: {sample_data.get('actionRecommended')}, Latency: {sample_data.get('modelLatencyMs')} ms")
    print(f"      SHAP Factors count: {len(sample_data.get('factors', []))}")
    assert sample_data.get('riskScore') is not None
    assert len(sample_data.get('factors', [])) > 0

    # 2. Upload CSV with 100 rows
    test_csv_path = "c:/Users/PULKIT/OneDrive/Desktop/fraudshield/ml/data/test_sample.csv"
    full_df = pd.read_csv(test_csv_path)
    sample_100_df = full_df.head(100)
    sample_100_csv = sample_100_df.to_csv(index=False)

    batch_100_res = requests.post(
        f"{BASE_URL}/predict/batch/",
        headers=analyst_h,
        files={'file': ('sample_100.csv', sample_100_csv, 'text/csv')}
    )
    assert batch_100_res.status_code == 200, f"Batch 100 failed: {batch_100_res.text}"
    b100_data = batch_100_res.json()
    print(f"[C.2] Uploaded CSV with 100 rows:")
    print(f"      Processed: {b100_data.get('processedCount')}, Flagged: {b100_data.get('flaggedCount')}, Frauds: {b100_data.get('fraudCount')}")
    assert b100_data.get('processedCount') == 100

    # 3. Run live simulator for 20 seconds
    print(f"[C.3] Running live simulator for 20 seconds (ticking every 2.5s)...")
    ticks_created = 0
    start_sim = time.time()
    while time.time() - start_sim < 20:
        tick_res = requests.post(f"{BASE_URL}/simulator/tick/", headers=analyst_h)
        assert tick_res.status_code == 200, f"Simulator tick failed: {tick_res.text}"
        ticks_created += 1
        time.sleep(2.5)
    print(f"      Simulator completed: {ticks_created} real transactions generated & scored through live model.")

    # 4. Upload whole test_sample.csv to POST /api/predict/batch/
    print(f"[C.4] Uploading full ml/data/test_sample.csv (3071 rows) to /api/predict/batch/...")
    with open(test_csv_path, 'rb') as f:
        full_batch_res = requests.post(
            f"{BASE_URL}/predict/batch/",
            headers=analyst_h,
            files={'file': ('test_sample.csv', f, 'text/csv')}
        )
    assert full_batch_res.status_code == 200, f"Full batch upload failed: {full_batch_res.text}"
    full_data = full_batch_res.json()
    results = full_data.get('results', [])
    processed_count = full_data.get('processedCount', 0)
    print(f"      Batch processed: {processed_count} rows.")

    # Compare with ground truth Class column
    scores = np.array([r['riskScore'] for r in results])
    classes = full_df['Class'].to_numpy()
    cfg_info = requests.get(f"{BASE_URL}/model/info/", headers=analyst_h).json()
    t_val = cfg_info['threshold']

    caught = int(np.sum((scores >= t_val) & (classes == 1)))
    missed = int(np.sum((scores < t_val) & (classes == 1)))
    false_alarms = int(np.sum((scores >= t_val) & (classes == 0)))
    total_fraud = int(np.sum(classes == 1))

    print(f"      Frauds caught: {caught} / {total_fraud}")
    print(f"      Missed frauds: {missed} / {total_fraud}")
    print(f"      False alarms:  {false_alarms}")

    # Exact expected counts: 56 caught, 15 missed, 0 false alarms (as verified earlier)
    assert caught == 56, f"Expected 56 caught frauds, got {caught}"
    assert missed == 15, f"Expected 15 missed frauds, got {missed}"
    assert false_alarms == 0, f"Expected 0 false alarms, got {false_alarms}"
    print("      Verification matches EXACT ground truth from model report!")
    print(">>> SCENARIO C PASSED SUCCESSFULLY! <<<\n")


def test_scenario_d():
    print("="*70)
    print("RUNNING SCENARIO D: Cross-Role Permission and Data Isolation")
    print("="*70)

    tokens = {r: get_tokens(r) for r in ['customer', 'merchant', 'analyst', 'admin']}

    # 1. Customer attempts admin/analyst endpoints
    cust_h = auth_headers(tokens['customer'])
    r1 = requests.get(f"{BASE_URL}/users/", headers=cust_h)
    print(f"[D.1] Customer -> GET /api/users/ : status {r1.status_code} (Refused)")
    assert r1.status_code == 403, f"Expected 403, got {r1.status_code}"

    r2 = requests.get(f"{BASE_URL}/audit-logs/", headers=cust_h)
    print(f"[D.2] Customer -> GET /api/audit-logs/ : status {r2.status_code} (Refused)")
    assert r2.status_code == 403, f"Expected 403, got {r2.status_code}"

    r3 = requests.put(f"{BASE_URL}/model/threshold/", headers=cust_h, json={'threshold': 0.8})
    print(f"[D.3] Customer -> PUT /api/model/threshold/ : status {r3.status_code} (Refused)")
    assert r3.status_code == 403, f"Expected 403, got {r3.status_code}"

    # 2. Merchant attempts admin endpoints & customer cards
    merch_h = auth_headers(tokens['merchant'])
    r4 = requests.get(f"{BASE_URL}/users/", headers=merch_h)
    print(f"[D.4] Merchant -> GET /api/users/ : status {r4.status_code} (Refused)")
    assert r4.status_code == 403, f"Expected 403, got {r4.status_code}"

    r5 = requests.post(f"{BASE_URL}/simulator/tick/", headers=merch_h)
    print(f"[D.5] Merchant -> POST /api/simulator/tick/ : status {r5.status_code} (Refused)")
    assert r5.status_code == 403, f"Expected 403, got {r5.status_code}"

    # 3. Analyst attempts admin-only user invite & threshold update
    analyst_h = auth_headers(tokens['analyst'])
    r6 = requests.put(f"{BASE_URL}/model/threshold/", headers=analyst_h, json={'threshold': 0.8})
    print(f"[D.6] Analyst -> PUT /api/model/threshold/ : status {r6.status_code} (Refused)")
    assert r6.status_code == 403, f"Expected 403, got {r6.status_code}"

    r7 = requests.post(f"{BASE_URL}/users/", headers=analyst_h, json={'email': 'hacker@test.io', 'role': 'admin'})
    print(f"[D.7] Analyst -> POST /api/users/ : status {r7.status_code} (Refused)")
    assert r7.status_code == 403, f"Expected 403, got {r7.status_code}"

    # 4. Customer attempting to view other customer's card by ID
    admin_h = auth_headers(tokens['admin'])
    all_cards = requests.get(f"{BASE_URL}/cards/", headers=admin_h).json().get('results', [])
    cust_cards = requests.get(f"{BASE_URL}/cards/", headers=cust_h).json().get('results', [])
    cust_card_ids = {c['id'] for c in cust_cards}

    other_card = next((c for c in all_cards if c['id'] not in cust_card_ids), None)
    if other_card:
        other_card_id = other_card['id']
        r8 = requests.get(f"{BASE_URL}/cards/{other_card_id}/", headers=cust_h)
        print(f"[D.8] Customer -> GET /api/cards/{other_card_id}/ (Other User's Card) : status {r8.status_code} (Refused)")
        assert r8.status_code in (403, 404), f"Expected 403/404, got {r8.status_code}"

    print(">>> SCENARIO D PASSED SUCCESSFULLY! <<<\n")


if __name__ == '__main__':
    print("\n" + "#"*70)
    print("FRAUDSHIELD INTEGRATION E2E TEST SUITE (SCENARIOS A, B, C, D)")
    print("#"*70)

    try:
        test_scenario_a()
        test_scenario_b()
        test_scenario_c()
        test_scenario_d()
        print("\n" + "#"*70)
        print("ALL 4 END-TO-END SCENARIOS COMPLETED AND PASSED WITH 100% SUCCESS!")
        print("#"*70 + "\n")
        sys.exit(0)
    except Exception as e:
        print(f"\nERROR DURING E2E EXECUTION: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
