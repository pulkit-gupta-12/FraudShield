import React, { useState } from 'react'
import {
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Lock,
  Layers,
  ArrowRight,
  TrendingUp,
  Cpu,
  Sliders,
  Bell,
} from 'lucide-react'
import { Button } from '../../components/ui/Button.jsx'
import { Input } from '../../components/ui/Input.jsx'
import { Select } from '../../components/ui/Select.jsx'
import { Textarea } from '../../components/ui/Textarea.jsx'
import { Toggle } from '../../components/ui/Toggle.jsx'
import { Slider } from '../../components/ui/Slider.jsx'
import { Checkbox } from '../../components/ui/Checkbox.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { StatCard } from '../../components/ui/StatCard.jsx'
import { RiskBadge } from '../../components/ui/RiskBadge.jsx'
import { StatusBadge } from '../../components/ui/StatusBadge.jsx'
import { DataTable } from '../../components/ui/DataTable.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { Drawer } from '../../components/ui/Drawer.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { Tabs } from '../../components/ui/Tabs.jsx'
import { Stepper } from '../../components/ui/Stepper.jsx'
import { Avatar } from '../../components/ui/Avatar.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { FilterBar } from '../../components/ui/FilterBar.jsx'
import { DateRangePicker } from '../../components/ui/DateRangePicker.jsx'
import { ChartCard } from '../../components/ui/ChartCard.jsx'
import { Timeline } from '../../components/ui/Timeline.jsx'
import { Accordion } from '../../components/ui/Accordion.jsx'
import { RiskMeter } from '../../components/charts/RiskMeter.jsx'
import { FactorsChart } from '../../components/charts/FactorsChart.jsx'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'

export function UiKitPage() {
  // Interactive UI Kit State
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [toggleVal, setToggleVal] = useState(true)
  const [checkboxVal, setCheckboxVal] = useState(true)
  const [sliderVal, setSliderVal] = useState(74)
  const [activeTab, setActiveTab] = useState('overview')
  const [activeStep, setActiveStep] = useState(1)
  const [tableLoading, setTableLoading] = useState(false)
  const [datePreset, setDatePreset] = useState('30d')

  // Sample factors for FactorsChart
  const sampleFactors = [
    { feature: 'V14', impact: 0.38, description: 'PCA vector 14 extreme negative anomaly', direction: 'risk_increasing' },
    { feature: 'Amount', impact: 0.24, description: '₹85,000 transaction value exceeds 99th percentile', direction: 'risk_increasing' },
    { feature: 'Time', impact: -0.18, description: 'Regular daytime transaction window (14:32 IST)', direction: 'risk_decreasing' },
    { feature: 'V10', impact: 0.15, description: 'Device fingerprint discrepancy in browser headers', direction: 'risk_increasing' },
    { feature: 'V12', impact: -0.11, description: 'Recognized terminal merchant relationship', direction: 'risk_decreasing' },
  ]

  // Sample data for DataTable
  const sampleTableData = [
    { id: 'TXN-100241', merchant: 'Flipkart Online', amount: '₹14,999', risk: 'FRAUD', score: 0.88, status: 'Blocked' },
    { id: 'TXN-100242', merchant: 'Swiggy Food', amount: '₹850', risk: 'LEGIT', score: 0.04, status: 'Approved' },
    { id: 'TXN-100243', merchant: 'Reliance Digital', amount: '₹62,400', risk: 'SUSPICIOUS', score: 0.58, status: 'Under Review' },
    { id: 'TXN-100244', merchant: 'MakeMyTrip Air', amount: '₹28,500', risk: 'SUSPICIOUS', score: 0.62, status: 'Under Review' },
    { id: 'TXN-100245', merchant: 'Apollo Pharmacy', amount: '₹1,240', risk: 'LEGIT', score: 0.02, status: 'Approved' },
  ]

  const tableColumns = [
    { key: 'id', header: 'Txn ID', sortable: true },
    { key: 'merchant', header: 'Merchant', sortable: true },
    { key: 'amount', header: 'Amount', sortable: true },
    {
      key: 'risk',
      header: 'Risk Tier',
      render: (row) => <RiskBadge level={row.risk} score={row.score} showScore={true} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ]

  // Sample chart data
  const chartData = [
    { date: 'Oct 01', score: 12 },
    { date: 'Oct 02', score: 18 },
    { date: 'Oct 03', score: 15 },
    { date: 'Oct 04', score: 42 },
    { date: 'Oct 05', score: 28 },
    { date: 'Oct 06', score: 65 },
    { date: 'Oct 07', score: 84 },
  ]

  return (
    <div className="space-y-12 pb-16 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="FraudShield Design System & UI Kit"
        description="Comprehensive gallery of all design system components, interactive states, tokens, and charts with zero hard-coded colors."
        badge={
          <span className="px-3 py-1 bg-primary-50 text-primary-700 border border-primary-200 rounded-full text-xs font-bold uppercase tracking-wider">
            Production Ready
          </span>
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast.success('UI Kit tokens synchronized!')}
          >
            Check Design Tokens
          </Button>
        }
      />

      {/* 1. Buttons */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-neutral-900 border-b pb-2">1. Button Variants & Sizes</h2>
        <div className="flex flex-wrap items-center gap-4 bg-white p-6 rounded-2xl border border-neutral-200">
          <Button variant="primary">Primary Action</Button>
          <Button variant="secondary">Secondary Action</Button>
          <Button variant="danger">Danger / Block</Button>
          <Button variant="ghost">Ghost Button</Button>
          <Button variant="primary" loading>Loading...</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-4 bg-white p-6 rounded-2xl border border-neutral-200">
          <Button size="sm" variant="primary">Small (sm)</Button>
          <Button size="md" variant="primary">Medium (md)</Button>
          <Button size="lg" variant="primary">Large (lg)</Button>
          <Button variant="primary" icon={<ShieldAlert className="w-4 h-4" />}>
            With Icon
          </Button>
        </div>
      </section>

      {/* 2. Stat Cards & Badges */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-neutral-900 border-b pb-2">2. StatCards, RiskBadges & StatusBadges</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Volume"
            value="₹1.42 Cr"
            icon={<TrendingUp className="w-5 h-5" />}
            trend="+14.2%"
            color="primary"
            subtitle="vs. last 30 days"
          />
          <StatCard
            title="Legit Transactions"
            value="376"
            icon={<CheckCircle2 className="w-5 h-5" />}
            trend="+94.0%"
            color="safe"
            subtitle="Safe score < 0.50"
          />
          <StatCard
            title="Flagged Review"
            value="48"
            icon={<AlertTriangle className="w-5 h-5" />}
            trend="+12.0%"
            color="review"
            subtitle="Requires review"
          />
          <StatCard
            title="Fraud Blocked"
            value="24"
            icon={<ShieldAlert className="w-5 h-5" />}
            trend="-3.8%"
            trendDirection="down"
            color="risk"
            subtitle="Critical severity"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white p-6 rounded-2xl border border-neutral-200">
          <span className="text-xs font-semibold text-neutral-400">Risk Badges:</span>
          <RiskBadge level="LEGIT" score={0.12} showScore />
          <RiskBadge level="SUSPICIOUS" score={0.54} showScore />
          <RiskBadge level="FRAUD" score={0.89} showScore />
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-6 rounded-2xl border border-neutral-200">
          <span className="text-xs font-semibold text-neutral-400">Status Badges:</span>
          <StatusBadge status="Approved" />
          <StatusBadge status="Under Review" />
          <StatusBadge status="Blocked" />
          <StatusBadge status="Open" />
          <StatusBadge status="Resolved" />
          <StatusBadge status="Suspended" />
        </div>
      </section>

      {/* 3. Form Controls */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-neutral-900 border-b pb-2">3. Form Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-2xl border border-neutral-200">
          <Input label="Standard Input" placeholder="Type something..." />
          <Input
            label="With Icon"
            leftIcon={<Search className="w-4 h-4" />}
            placeholder="Search query..."
          />
          <Input
            label="Error State"
            error="Invalid PAN / Aadhaar identifier"
            defaultValue="ABCDE1234"
          />

          <Select
            label="Dropdown Select"
            options={[
              { label: 'All Channels', value: 'all' },
              { label: 'POS Terminal', value: 'pos' },
              { label: 'UPI QR Pay', value: 'upi' },
              { label: 'Online Gateway', value: 'online' },
            ]}
          />

          <Textarea label="Investigation Note" placeholder="Add case findings..." rows={2} />

          <div className="space-y-4 pt-2">
            <Toggle
              label="Real-time Webhook Alerts"
              description="Dispatch WebSocket event on high risk detection"
              checked={toggleVal}
              onChange={setToggleVal}
            />
            <Checkbox
              label="Require 2FA OTP for flagged chargebacks"
              description="Sends instant SMS to cardholder mobile"
              checked={checkboxVal}
              onChange={setCheckboxVal}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-neutral-200 max-w-xl">
          <Slider
            label="Dynamic Fraud Risk Cutoff Score"
            value={sliderVal}
            min={0}
            max={100}
            onChange={setSliderVal}
            formatValue={(v) => `${v}%`}
          />
        </div>
      </section>

      {/* 4. Visualizations: RiskMeter & FactorsChart */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-neutral-900 border-b pb-2">4. Charts & Gauges</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* RiskMeter Card */}
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 flex flex-col items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 text-center">Interactive RiskMeter Gauge</h3>
              <p className="text-xs text-neutral-500 text-center mt-1">
                Drag slider below to test needle and threshold marker at 89% (review floor at 50%)
              </p>
            </div>
            <div className="py-4">
              <RiskMeter value={sliderVal} threshold={89} warningThreshold={50} size={220} />
            </div>
            <div className="w-full">
              <Slider
                value={sliderVal}
                min={0}
                max={100}
                onChange={setSliderVal}
                formatValue={(v) => `Gauge: ${v}%`}
              />
            </div>
          </div>

          {/* FactorsChart Card */}
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Explainable AI (FactorsChart)</h3>
              <p className="text-xs text-neutral-500 mt-1">
                Feature attribution weights (SHAP/LIME style breakdown)
              </p>
            </div>
            <div className="py-3">
              <FactorsChart factors={sampleFactors} maxItems={5} />
            </div>
            <p className="text-[11px] text-neutral-400 text-center border-t pt-2">
              Values above baseline contribute positively to fraud probability
            </p>
          </div>

          {/* ChartCard with Area Chart */}
          <ChartCard
            title="Fraud Detection Trend"
            subtitle="Hourly risk progression score"
            legend={
              <span className="text-[11px] font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                Live Feed
              </span>
            }
          >
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorScore" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorScore)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>

      {/* 5. DataTable */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-lg font-bold text-neutral-900">5. DataTable Component</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setTableLoading(!tableLoading)}
            >
              Toggle Skeleton ({tableLoading ? 'ON' : 'OFF'})
            </Button>
          </div>
        </div>

        <DataTable
          columns={tableColumns}
          data={sampleTableData}
          loading={tableLoading}
          onRowClick={(row) => toast(`Clicked ${row.id}: ${row.merchant}`)}
          filterSlot={<DateRangePicker value={datePreset} onChange={setDatePreset} />}
        />
      </section>

      {/* 6. Overlays (Modal, Drawer, ConfirmDialog) */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-neutral-900 border-b pb-2">6. Overlays & Dialogs</h2>
        <div className="flex flex-wrap items-center gap-4 bg-white p-6 rounded-2xl border border-neutral-200">
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Open Standard Modal
          </Button>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
            Open Slide-over Drawer
          </Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Trigger ConfirmDialog
          </Button>
        </div>

        {/* Modal Instance */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Transaction Details (Modal)"
          description="Detailed metadata review for cardholder TXN-100241"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  toast.success('Transaction approved')
                  setModalOpen(false)
                }}
              >
                Approve Charge
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-xs">
            <p className="text-neutral-600">
              This modal component provides focus trapping, backdrop blur, Escape key dismissal, and custom action footers.
            </p>
            <div className="p-3 bg-neutral-50 rounded-xl space-y-1">
              <p><strong>Merchant:</strong> Flipkart Internet Pvt Ltd</p>
              <p><strong>Amount:</strong> ₹14,999.00</p>
              <p><strong>Channel:</strong> Web Checkout 3DS</p>
            </div>
          </div>
        </Modal>

        {/* Drawer Instance */}
        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Analyst Slide-over Inspector"
          description="Deep investigation inspection side-panel"
          footer={
            <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)}>
              Close Panel
            </Button>
          }
        >
          <div className="space-y-4 text-xs text-neutral-600">
            <p>
              Slide-over drawer is ideal for detailed transaction inspection, customer KYC profiles, and real-time rule test consoles.
            </p>
            <RiskMeter value={84} threshold={89} warningThreshold={50} size={180} />
            <FactorsChart factors={sampleFactors.slice(0, 3)} />
          </div>
        </Drawer>

        {/* ConfirmDialog Instance */}
        <ConfirmDialog
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => {
            toast.success('Card blocked successfully')
            setConfirmOpen(false)
          }}
          title="Block Credit Card?"
          message="Are you sure you want to suspend card ending in 4821? Future charges will be declined immediately."
          confirmText="Yes, Block Card"
        />
      </section>

      {/* 7. Workflow & Navigational (Tabs, Stepper, Timeline, Accordion) */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-neutral-900 border-b pb-2">7. Tabs, Stepper, Timeline & Accordion</h2>
        <div className="space-y-6 bg-white p-6 rounded-2xl border border-neutral-200">
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Tabs (Pill variant):</p>
            <Tabs
              tabs={[
                { id: 'overview', label: 'Overview', icon: <Layers className="w-3.5 h-3.5" />, count: 12 },
                { id: 'investigate', label: 'Investigation Queue', icon: <Search className="w-3.5 h-3.5" />, count: 4 },
                { id: 'alerts', label: 'Alerts', icon: <Bell className="w-3.5 h-3.5" />, count: 2 },
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Stepper Progression:</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setActiveStep((s) => Math.max(0, s - 1))}>
                  Previous
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setActiveStep((s) => Math.min(3, s + 1))}>
                  Next Step
                </Button>
              </div>
            </div>
            <Stepper
              steps={[
                { label: 'Detection', description: 'Rule & model scoring' },
                { label: 'Analyst Triage', description: 'Priority assignment' },
                { label: 'Customer Verification', description: 'OTP confirmation' },
                { label: 'Resolution', description: 'Closed or chargeback' },
              ]}
              currentStep={activeStep}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-neutral-100">
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Timeline Component:</p>
              <Timeline
                items={[
                  { id: '1', timestamp: new Date(Date.now() - 3600000).toISOString(), action: 'Anomalous Velocity Flagged', note: 'TXN-100241 scored 88% fraud risk', user: 'Auto-Engine' },
                  { id: '2', timestamp: new Date(Date.now() - 1800000).toISOString(), action: 'Cardholder Notified via SMS', note: 'Sent verification code to +91 98***', user: 'Analyst Priya' },
                  { id: '3', timestamp: new Date(Date.now() - 300000).toISOString(), action: 'Card Placed on Temporary Hold', note: 'Awaiting customer dispute confirmation', user: 'Ops Desk' },
                ]}
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Accordion Component:</p>
              <Accordion
                items={[
                  {
                    id: 'acc1',
                    title: 'XGBoost Classification Thresholds',
                    subtitle: 'Operational boundary rules',
                    content: 'Transactions with probability >= 0.89 are automatically blocked. Between 0.50 and 0.89 are routed to Level 2 analysts for manual review.',
                  },
                  {
                    id: 'acc2',
                    title: 'SMOTE Class Imbalance Handling',
                    subtitle: 'Training dataset augmentation',
                    content: 'Synthetic Minority Over-sampling Technique (SMOTE) is applied to the fraud minority class to balance training gradients without overfitting.',
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 8. Avatars, Skeletons, Empty & Error States */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-neutral-900 border-b pb-2">8. Feedback & State Placeholders</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 space-y-4">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Avatar Sizes & Statuses:</p>
            <div className="flex items-center gap-4">
              <Avatar name="Aarav Sharma" size="sm" status="online" />
              <Avatar name="Priya Patel" size="md" status="busy" />
              <Avatar name="Rohan Verma" size="lg" status="offline" />
              <Avatar name="Ananya Rao" size="xl" />
            </div>

            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider pt-4">Skeleton Loaders:</p>
            <div className="space-y-2">
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="90%" />
              <Skeleton variant="rectangular" height={40} />
            </div>
          </div>

          <div className="space-y-4">
            <EmptyState
              title="No Blocked Transactions"
              description="All transactions within the selected 7-day window passed compliance checks."
            />
            <ErrorState
              title="Model Scoring API Timed Out"
              message="Retrying connection to backend ML worker pool."
              onRetry={() => toast('Retrying model connection...')}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
