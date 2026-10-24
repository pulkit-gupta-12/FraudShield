#!/usr/bin/env python
"""
Contract Check Script:
Verifies that all API endpoints in docs/API_CONTRACT.md match the response shapes,
keys, and types expected by the frontend for each user role.

Usage:
    python scripts/contract_check.py [--base-url http://127.0.0.1:8000/api]
"""

import sys
import json
import argparse
import urllib.request
import urllib.error
from typing import Dict, Any, List, Tuple

BASE_URL_DEFAULT = "http://127.0.0.1:8000/api"

DEMO_USERS = {
    'admin': ('admin@fraudshield.io', 'Admin@123'),
    'analyst': ('analyst@fraudshield.io', 'Analyst@123'),
    'customer': ('customer@fraudshield.io', 'Customer@123'),
    'merchant': ('merchant@fraudshield.io', 'Merchant@123'),
}

# Contract specifications for endpoints and expected keys
# Format: { 'expected_keys': { key: type_or_callable }, 'allow_extra': bool }

CONTRACTS = {
    'auth_login': {
        'expected_keys': {
            'access': str,
            'refresh': str,
            'user': dict,
        },
        'user_keys': {
            'id': (int, str),
            'email': str,
            'name': str,
            'role': str,
            'status': str,
        }
    },
    'auth_me': {
        'expected_keys': {
            'id': (int, str),
            'email': str,
            'name': str,
            'role': str,
            'status': str,
            'organisation': str,
            'department': str,
            'city': str,
            'phone': str,
        }
    },
    'health': {
        'expected_keys': {
            'status': str,
            'modelLoaded': bool,
            'modelVersion': str,
        }
    },
    'transactions_list': {
        'expected_keys': {
            'results': list,
            'count': int,
        },
        'item_keys': {
            'id': (int, str),
            'publicId': str,
            'cardLast4': str,
            'customerName': str,
            'merchant': str,
            'amountINR': (int, float),
            'riskScore': (int, float),
            'band': str,
            'status': str,
            'timestamp': str,
        }
    },
    'transaction_detail': {
        'expected_keys': {
            'id': (int, str),
            'publicId': str,
            'cardLast4': str,
            'customerName': str,
            'merchant': str,
            'amountINR': (int, float),
            'riskScore': (int, float),
            'band': str,
            'status': str,
            'factors': list,
        }
    },
    'alerts_list': {
        'expected_keys': {
            'results': list,
            'count': int,
        },
        'item_keys': {
            'id': int,
            'transactionId': str,
            'customerName': str,
            'merchant': str,
            'amountINR': (int, float),
            'severity': str,
            'status': str,
        }
    },
    'cases_list': {
        'expected_keys': {
            'results': list,
            'count': int,
        },
        'item_keys': {
            'id': int,
            'caseId': str,
            'transactionId': str,
            'status': str,
            'priority': str,
            'outcome': str,
        }
    },
    'case_detail': {
        'expected_keys': {
            'id': int,
            'caseId': str,
            'transactionId': str,
            'status': str,
            'priority': str,
            'outcome': str,
            'transaction': dict,
            'notes': list,
            'timeline': list,
        }
    },
    'cards_list': {
        'expected_keys': {
            'results': list,
            'count': int,
        },
        'item_keys': {
            'id': int,
            'userId': int,
            'cardNumber': str,
            'last4': str,
            'status': str,
        }
    },
    'disputes_list': {
        'expected_keys': {
            'results': list,
            'count': int,
        },
        'item_keys': {
            'id': int,
            'disputeId': str,
            'transactionId': str,
            'reason': str,
            'status': str,
            'stage': str,
        }
    },
    'notifications_list': {
        'expected_keys': {
            'results': list,
            'count': int,
            'unreadCount': int,
        },
        'item_keys': {
            'id': int,
            'type': str,
            'title': str,
            'body': str,
            'link': str,
            'createdAt': str,
        }
    },
    'model_info': {
        'expected_keys': {
            'threshold': (int, float),
            'reviewFloor': (int, float),
            'modelVersion': str,
            'algorithm': str,
            'metrics': dict,
            'confusionMatrix': dict,
            'prCurve': list,
            'featureImportance': list,
        }
    },
    'model_config': {
        'expected_keys': {
            'threshold': (int, float),
            'reviewFloor': (int, float),
            'suspiciousThreshold': (int, float),
            'fraudThreshold': (int, float),
            'autoBlockScore': (int, float),
        }
    },
    'model_what_if': {
        'expected_keys': {
            'threshold': (int, float),
            'totalEvaluated': int,
            'flagged': int,
            'caught': int,
            'falseAlarms': int,
            'precision': (int, float),
            'recall': (int, float),
        }
    },
    'predict_single': {
        'expected_keys': {
            'riskScore': (int, float),
            'band': str,
            'actionRecommended': str,
            'modelLatencyMs': (int, float),
            'threshold': (int, float),
            'reviewFloor': (int, float),
            'factors': list,
        }
    },
    'predict_samples': {
        'expected_type': list,
        'item_keys': {
            'id': str,
            'Time': (int, float),
            'Amount': (int, float),
        }
    },
    'simulator_tick': {
        'expected_keys': {
            'id': (int, str),
            'publicId': str,
            'amountINR': (int, float),
            'riskScore': (int, float),
            'band': str,
            'status': str,
        }
    },
    'stats_overview': {
        'expected_keys': {
            'totalTransactions': int,
            'fraudCount': int,
            'fraudDetected': int,
            'suspiciousCount': int,
            'legitCount': int,
            'fraudRate': (int, float),
            'fraudVolumeINR': (int, float),
            'totalVolumeINR': (int, float),
            'activeAlerts': int,
            'openCases': int,
        }
    },
    'stats_timeseries': {
        'expected_type': list,
        'item_keys': {
            'date': str,
            'total': int,
            'fraud': int,
            'suspicious': int,
        }
    },
    'stats_by_hour': {
        'expected_type': list,
        'item_keys': {
            'hour': int,
            'label': str,
            'total': int,
            'fraud': int,
        }
    },
    'stats_by_category': {
        'expected_type': list,
        'item_keys': {
            'category': str,
            'total': int,
            'fraud': int,
            'volumeINR': (int, float),
        }
    },
    'stats_risk_distribution': {
        'expected_type': list,
        'item_keys': {
            'band': str,
            'count': int,
            'color': str,
        }
    },
    'stats_analyst': {
        'expected_type': list,
        'item_keys': {
            'analystId': int,
            'analystName': str,
            'totalCases': int,
            'resolved': int,
            'avgResolutionHrs': (int, float),
        }
    },
    'stats_merchant': {
        'expected_type': list,
        'item_keys': {
            'merchant': str,
            'fraudRate': (int, float),
            'fraudCount': int,
            'totalCount': int,
            'volumeINR': (int, float),
        }
    },
    'stats_customer': {
        'expected_keys': {
            'totalSpentINR': (int, float),
            'transactionCount': int,
            'activeCardsCount': int,
            'flaggedCount': int,
            'disputesCount': int,
        }
    },
    'users_list': {
        'expected_keys': {
            'results': list,
            'count': int,
        },
        'item_keys': {
            'id': int,
            'name': str,
            'email': str,
            'role': str,
            'status': str,
        }
    },
    'users_access_requests': {
        'expected_keys': {
            'results': list,
            'count': int,
        }
    },
    'audit_logs': {
        'expected_keys': {
            'results': list,
            'count': int,
        },
        'item_keys': {
            'id': int,
            'actor': str,
            'role': str,
            'action': str,
            'target': str,
            'status': str,
        }
    },
    'reports_daily': {
        'expected_keys': {
            'columns': list,
            'rows': list,
            'chart': dict,
        }
    },
}

class ApiTester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.tokens = {}
        self.mismatches: List[Tuple[str, str, str, str]] = []  # (role, endpoint, issue, detail)

    def request(self, method: str, path: str, token: str = None, data: dict = None) -> Tuple[int, Any]:
        url = f"{self.base_url}{path}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f"Bearer {token}"

        body = json.dumps(data).encode('utf-8') if data is not None else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req) as resp:
                status = resp.status
                content = resp.read()
                try:
                    return status, json.loads(content)
                except Exception:
                    return status, content.decode('utf-8', errors='replace')
        except urllib.error.HTTPError as e:
            content = e.read()
            try:
                return e.code, json.loads(content)
            except Exception:
                return e.code, content.decode('utf-8', errors='replace')
        except Exception as e:
            return 0, str(e)

    def login_all(self):
        print("\n--- 1. Authenticating Demo Roles ---")
        for role, (email, password) in DEMO_USERS.items():
            status, res = self.request('POST', '/auth/login/', data={'email': email, 'password': password})
            if status == 200 and isinstance(res, dict) and 'access' in res:
                self.tokens[role] = res['access']
                print(f"  [OK] {role.upper():<10} logged in ({email})")
                # Check login response contract
                self.validate_contract('PUBLIC', '/api/auth/login/', res, CONTRACTS['auth_login'])
            else:
                print(f"  [FAIL] {role.upper():<10} login failed: {status} {res}")
                self.mismatches.append((role, '/api/auth/login/', 'login_failed', f"Status {status}: {res}"))

    def validate_contract(self, role: str, endpoint: str, data: Any, contract: dict):
        if not isinstance(data, dict) and not isinstance(data, list):
            self.mismatches.append((role, endpoint, 'wrong_type', f"Expected object or list, got {type(data).__name__}"))
            return

        expected_type = contract.get('expected_type', dict)
        if expected_type == list:
            if not isinstance(data, list):
                self.mismatches.append((role, endpoint, 'wrong_type', f"Expected list, got {type(data).__name__}"))
                return
            if data and 'item_keys' in contract:
                first_item = data[0]
                if isinstance(first_item, dict):
                    for k, expected_t in contract['item_keys'].items():
                        if k not in first_item:
                            self.mismatches.append((role, endpoint, 'missing_key', f"List item missing key: '{k}'"))
                        elif not isinstance(first_item[k], expected_t) and first_item[k] is not None:
                            self.mismatches.append((role, endpoint, 'wrong_type', f"Item key '{k}' expected {expected_t}, got {type(first_item[k]).__name__}"))
            return

        # Object check
        if 'expected_keys' in contract:
            for k, expected_t in contract['expected_keys'].items():
                if k not in data:
                    self.mismatches.append((role, endpoint, 'missing_key', f"Missing key: '{k}'"))
                elif not isinstance(data[k], expected_t) and data[k] is not None:
                    self.mismatches.append((role, endpoint, 'wrong_type', f"Key '{k}' expected {expected_t}, got {type(data[k]).__name__}"))

        # User keys check for login
        if 'user_keys' in contract and 'user' in data and isinstance(data['user'], dict):
            for k, expected_t in contract['user_keys'].items():
                if k not in data['user']:
                    self.mismatches.append((role, endpoint, 'missing_key', f"user.{k} missing"))

        # Check list items inside results
        if 'item_keys' in contract and 'results' in data and isinstance(data['results'], list):
            if data['results']:
                first_item = data['results'][0]
                if isinstance(first_item, dict):
                    for k, expected_t in contract['item_keys'].items():
                        if k not in first_item:
                            self.mismatches.append((role, endpoint, 'missing_key', f"results[0] missing key: '{k}'"))
                        elif not isinstance(first_item[k], expected_t) and first_item[k] is not None:
                            self.mismatches.append((role, endpoint, 'wrong_type', f"results[0].{k} expected {expected_t}, got {type(first_item[k]).__name__}"))

    def check_endpoint(self, role: str, method: str, path: str, contract_name: str, data: dict = None) -> Any:
        token = self.tokens.get(role)
        status, res = self.request(method, path, token=token, data=data)
        endpoint_label = f"{method} {path}"

        if status not in (200, 201):
            self.mismatches.append((role, endpoint_label, 'status_error', f"HTTP {status}: {str(res)[:100]}"))
            return None

        contract = CONTRACTS.get(contract_name)
        if contract:
            self.validate_contract(role, endpoint_label, res, contract)

        return res

    def run_all_checks(self):
        self.login_all()

        print("\n--- 2. Checking Public Endpoints ---")
        st, res = self.request('GET', '/health/')
        self.validate_contract('PUBLIC', 'GET /api/health/', res, CONTRACTS['health'])

        # Token refresh check
        admin_tok = self.tokens.get('admin')
        if admin_tok:
            # Get refresh token
            _, login_res = self.request('POST', '/auth/login/', data={'email': 'admin@fraudshield.io', 'password': 'Admin@123'})
            if isinstance(login_res, dict) and 'refresh' in login_res:
                ref_st, ref_res = self.request('POST', '/auth/refresh/', data={'refresh': login_res['refresh']})
                self.validate_contract('PUBLIC', 'POST /api/auth/refresh/', ref_res, {
                    'expected_keys': {'access': str, 'refresh': str}
                })

        print("\n--- 3. Checking Admin Endpoints ---")
        if 'admin' in self.tokens:
            self.check_endpoint('admin', 'GET', '/auth/me/', 'auth_me')
            txns = self.check_endpoint('admin', 'GET', '/transactions/', 'transactions_list')
            if txns and txns.get('results'):
                first_id = txns['results'][0].get('id') or txns['results'][0].get('publicId')
                self.check_endpoint('admin', 'GET', f"/transactions/{first_id}/", 'transaction_detail')

            self.check_endpoint('admin', 'GET', '/alerts/', 'alerts_list')
            cases = self.check_endpoint('admin', 'GET', '/cases/', 'cases_list')
            if cases and cases.get('results'):
                first_case_id = cases['results'][0].get('id')
                self.check_endpoint('admin', 'GET', f"/cases/{first_case_id}/", 'case_detail')

            self.check_endpoint('admin', 'GET', '/cards/', 'cards_list')
            self.check_endpoint('admin', 'GET', '/disputes/', 'disputes_list')
            self.check_endpoint('admin', 'GET', '/notifications/', 'notifications_list')

            self.check_endpoint('admin', 'GET', '/model/info/', 'model_info')
            self.check_endpoint('admin', 'GET', '/model/config/', 'model_config')
            self.check_endpoint('admin', 'GET', '/model/what-if/', 'model_what_if')

            valid_txn_id = first_id if 'first_id' in locals() and first_id else 'TXN-000001'
            self.check_endpoint('admin', 'POST', '/predict/', 'predict_single', data={'transactionId': valid_txn_id})
            self.check_endpoint('admin', 'GET', '/predict/samples/', 'predict_samples')
            self.check_endpoint('admin', 'POST', '/simulator/tick/', 'simulator_tick')

            self.check_endpoint('admin', 'GET', '/stats/overview/', 'stats_overview')
            self.check_endpoint('admin', 'GET', '/stats/timeseries/', 'stats_timeseries')
            self.check_endpoint('admin', 'GET', '/stats/by-hour/', 'stats_by_hour')
            self.check_endpoint('admin', 'GET', '/stats/by-category/', 'stats_by_category')
            self.check_endpoint('admin', 'GET', '/stats/risk-distribution/', 'stats_risk_distribution')
            self.check_endpoint('admin', 'GET', '/stats/analyst/', 'stats_analyst')
            self.check_endpoint('admin', 'GET', '/stats/merchant/', 'stats_merchant')
            self.check_endpoint('admin', 'GET', '/stats/customer/', 'stats_customer')

            self.check_endpoint('admin', 'GET', '/users/', 'users_list')
            self.check_endpoint('admin', 'GET', '/users/access-requests/', 'users_access_requests')
            self.check_endpoint('admin', 'GET', '/audit-logs/', 'audit_logs')
            self.check_endpoint('admin', 'GET', '/reports/?type=daily_summary', 'reports_daily')

        print("\n--- 4. Checking Analyst Endpoints ---")
        if 'analyst' in self.tokens:
            self.check_endpoint('analyst', 'GET', '/auth/me/', 'auth_me')
            analyst_txns = self.check_endpoint('analyst', 'GET', '/transactions/', 'transactions_list')
            analyst_txn_id = valid_txn_id
            if analyst_txns and analyst_txns.get('results'):
                analyst_txn_id = analyst_txns['results'][0].get('id') or analyst_txns['results'][0].get('publicId')

            self.check_endpoint('analyst', 'GET', '/alerts/', 'alerts_list')
            self.check_endpoint('analyst', 'GET', '/cases/', 'cases_list')
            self.check_endpoint('analyst', 'GET', '/cards/', 'cards_list')
            self.check_endpoint('analyst', 'GET', '/disputes/', 'disputes_list')
            self.check_endpoint('analyst', 'GET', '/notifications/', 'notifications_list')

            self.check_endpoint('analyst', 'GET', '/model/info/', 'model_info')
            self.check_endpoint('analyst', 'GET', '/model/config/', 'model_config')
            self.check_endpoint('analyst', 'POST', '/predict/', 'predict_single', data={'transactionId': analyst_txn_id})
            self.check_endpoint('analyst', 'GET', '/predict/samples/', 'predict_samples')
            self.check_endpoint('analyst', 'POST', '/simulator/tick/', 'simulator_tick')

            self.check_endpoint('analyst', 'GET', '/stats/overview/', 'stats_overview')
            self.check_endpoint('analyst', 'GET', '/stats/timeseries/', 'stats_timeseries')
            self.check_endpoint('analyst', 'GET', '/stats/by-hour/', 'stats_by_hour')
            self.check_endpoint('analyst', 'GET', '/stats/by-category/', 'stats_by_category')
            self.check_endpoint('analyst', 'GET', '/stats/risk-distribution/', 'stats_risk_distribution')
            self.check_endpoint('analyst', 'GET', '/stats/analyst/', 'stats_analyst')
            self.check_endpoint('analyst', 'GET', '/stats/merchant/', 'stats_merchant')

        print("\n--- 5. Checking Customer Endpoints ---")
        if 'customer' in self.tokens:
            self.check_endpoint('customer', 'GET', '/auth/me/', 'auth_me')
            self.check_endpoint('customer', 'GET', '/transactions/', 'transactions_list')
            self.check_endpoint('customer', 'GET', '/alerts/', 'alerts_list')
            self.check_endpoint('customer', 'GET', '/cards/', 'cards_list')
            self.check_endpoint('customer', 'GET', '/disputes/', 'disputes_list')
            self.check_endpoint('customer', 'GET', '/notifications/', 'notifications_list')
            self.check_endpoint('customer', 'GET', '/stats/customer/', 'stats_customer')

        print("\n--- 6. Checking Merchant Endpoints ---")
        if 'merchant' in self.tokens:
            self.check_endpoint('merchant', 'GET', '/auth/me/', 'auth_me')
            merchant_txns = self.check_endpoint('merchant', 'GET', '/transactions/', 'transactions_list')
            merchant_txn_id = valid_txn_id
            if merchant_txns and merchant_txns.get('results'):
                merchant_txn_id = merchant_txns['results'][0].get('id') or merchant_txns['results'][0].get('publicId')

            self.check_endpoint('merchant', 'GET', '/disputes/', 'disputes_list')
            self.check_endpoint('merchant', 'GET', '/notifications/', 'notifications_list')
            self.check_endpoint('merchant', 'GET', '/model/info/', 'model_info')
            self.check_endpoint('merchant', 'POST', '/predict/', 'predict_single', data={'transactionId': merchant_txn_id})
            self.check_endpoint('merchant', 'GET', '/stats/overview/', 'stats_overview')
            self.check_endpoint('merchant', 'GET', '/stats/timeseries/', 'stats_timeseries')
            self.check_endpoint('merchant', 'GET', '/stats/merchant/', 'stats_merchant')
            self.check_endpoint('merchant', 'GET', '/reports/?type=merchant_summary', 'reports_daily')

        self.print_report()

    def print_report(self):
        print("\n" + "="*80)
        print("                  CONTRACT CHECK REPORT")
        print("="*80)
        if not self.mismatches:
            print(">>> ALL CONTRACTS PASS WITH ZERO MISMATCHES! <<<")
            print("="*80)
            return 0

        print(f"Total Mismatches Found: {len(self.mismatches)}")
        print(f"{'ROLE':<10} | {'ENDPOINT':<32} | {'ISSUE':<15} | {'DETAIL'}")
        print("-" * 80)
        for role, endpoint, issue, detail in self.mismatches:
            print(f"{role:<10} | {endpoint:<32} | {issue:<15} | {detail}")
        print("="*80)
        return len(self.mismatches)

def main():
    parser = argparse.ArgumentParser(description="API Contract Verification")
    parser.add_argument('--base-url', default=BASE_URL_DEFAULT, help=f"Backend base URL (default: {BASE_URL_DEFAULT})")
    args = parser.parse_args()

    tester = ApiTester(args.base_url)
    tester.run_all_checks()
    sys.exit(0 if not tester.mismatches else 1)

if __name__ == '__main__':
    main()
