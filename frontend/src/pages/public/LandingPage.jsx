import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Zap, Activity, Users, ArrowRight, Lock, BarChart3, CheckCircle2 } from 'lucide-react'

export function LandingPage() {
  return (
    <div className="space-y-16 pb-12">
      {/* Hero Section */}
      <section className="text-center pt-8 sm:pt-16 max-w-4xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-xs font-semibold uppercase tracking-wider mb-6 animate-pulse">
          <Zap className="w-3.5 h-3.5 text-primary-600" />
          Real-Time Machine Learning Pipeline
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-neutral-900 leading-tight">
          Next-Generation AI Defense Against{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-indigo-700">
            Credit Card Fraud
          </span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-neutral-600 max-w-2xl mx-auto">
          FraudShield empowers financial institutions, fraud investigators, and consumers with explainable AI, millisecond-latency risk scoring, and automated case management.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/login"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-base shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 group"
          >
            Launch Live Demo
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </Link>
          <Link
            to="/ui-kit"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-700 font-semibold text-base shadow-xs transition flex items-center justify-center gap-2"
          >
            Explore Component UI Kit
          </Link>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center divide-y sm:divide-y-0 sm:divide-x divide-neutral-100">
          <div className="pt-4 sm:pt-0">
            <p className="text-3xl sm:text-4xl font-extrabold text-neutral-900">284,807</p>
            <p className="text-xs sm:text-sm text-neutral-500 font-medium uppercase tracking-wider mt-1">
              Transactions Modeled
            </p>
          </div>
          <div className="pt-4 sm:pt-0">
            <p className="text-3xl sm:text-4xl font-extrabold text-safe-600">₹4.8 Cr+</p>
            <p className="text-xs sm:text-sm text-neutral-500 font-medium uppercase tracking-wider mt-1">
              Simulated Fraud Prevented
            </p>
          </div>
          <div className="pt-4 sm:pt-0">
            <p className="text-3xl sm:text-4xl font-extrabold text-primary-600">99.94%</p>
            <p className="text-xs sm:text-sm text-neutral-500 font-medium uppercase tracking-wider mt-1">
              XGBoost Test Accuracy
            </p>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-neutral-900">Enterprise-Grade Risk Infrastructure</h2>
          <p className="text-sm text-neutral-500 mt-2">
            Engineered specifically to solve high class-imbalance fraud challenges.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs hover:border-primary-300 transition">
            <div className="w-12 h-12 rounded-xl bg-safe-50 text-safe-600 flex items-center justify-center mb-4">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-2">Real-Time Risk Scoring</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Sub-20ms inference using optimized tree classifiers. Evaluate transaction velocity, distance leaps, and PCA vectors seamlessly.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs hover:border-primary-300 transition">
            <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-2">4 Specialized Personas</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Dedicated interfaces tailored for Admins, Fraud Analysts, Retail Cardholders, and Partner Merchants with full RBAC protection.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs hover:border-primary-300 transition">
            <div className="w-12 h-12 rounded-xl bg-review-50 text-review-600 flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-2">Explainable AI (XAI)</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Every prediction is broken down into top 5 contributing factors with directional impact, making investigation intuitive.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
