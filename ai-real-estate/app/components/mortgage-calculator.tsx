'use client';

import React, { useState } from 'react';

interface MortgageCalculatorProps {
  defaultPrice?: number;
}

interface LoanOption {
  id: string;
  name: string;
  interestRate: number;
  loanTermYears: number;
}

export default function MortgageCalculator({ defaultPrice = 850000 }: MortgageCalculatorProps) {
  const [propertyPrice, setPropertyPrice] = useState<number>(defaultPrice);
  const [deposit, setDeposit] = useState<number>(defaultPrice * 0.2);
  const [interestRate, setInterestRate] = useState<number>(6.5);
  const [loanTermYears, setLoanTermYears] = useState<number>(30);
  const [activeTab, setActiveTab] = useState<'calculator' | 'compare'>('calculator');

  // Pre-populated comparison options for buyers
  const [comparisonLoans, setComparisonLoans] = useState<LoanOption[]>([
    { id: '1', name: 'Standard 30-Year Fixed', interestRate: 6.5, loanTermYears: 30 },
    { id: '2', name: 'Aggressive 15-Year Fixed', interestRate: 5.9, loanTermYears: 15 },
    { id: '3', name: '5-Year Introductory Rate', interestRate: 5.2, loanTermYears: 30 },
  ]);

  const loanAmount = Math.max(0, propertyPrice - deposit);

  const calculateMonthlyRepayment = (rate: number, term: number) => {
    if (loanAmount <= 0) return 0;
    const monthlyRate = rate / 100 / 12;
    const totalPayments = term * 12;

    if (monthlyRate === 0) return loanAmount / totalPayments;

    const monthlyPayment =
      (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments))) /
      (Math.pow(1 + monthlyRate, totalPayments) - 1);

    return isNaN(monthlyPayment) ? 0 : monthlyPayment;
  };

  const monthlyRepayment = calculateMonthlyRepayment(interestRate, loanTermYears);
  const fortnightlyRepayment = (monthlyRepayment * 12) / 26;
  const weeklyRepayment = (monthlyRepayment * 12) / 52;

  return (
    <div className="p-6 bg-white rounded-xl shadow-md border border-gray-100 max-w-3xl mx-auto my-6 text-gray-800">
      {/* Header and Mode Switcher Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 border-b pb-4 gap-4">
        <h2 className="text-xl font-bold text-gray-900">Mortgage & Financing Center</h2>
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('calculator')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'calculator' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Calculator
          </button>
          <button
            onClick={() => setActiveTab('compare')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'compare' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Compare Loans
          </button>
        </div>
      </div>

      {/* Shared Inputs for Property Price & Deposit */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Property Price (\$)</label>
          <input
            type="number"
            value={propertyPrice}
            onChange={(e) => setPropertyPrice(Number(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Deposit (\$)</label>
          <input
            type="number"
            value={deposit}
            onChange={(e) => setDeposit(Number(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Conditional View: Calculator vs. Comparison */}
      {activeTab === 'calculator' ? (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Interest Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Loan Term (Years)</label>
              <select
                value={loanTermYears}
                onChange={(e) => setLoanTermYears(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value={15}>15 years</option>
                <option value={20}>20 years</option>
                <option value={25}>25 years</option>
                <option value={30}>30 years</option>
              </select>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg text-center border border-blue-100">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider block">
              Estimated Repayment (Loan Amount: \${loanAmount.toLocaleString()})
            </span>
            <div className="text-3xl font-extrabold text-blue-900 my-1">
              \${monthlyRepayment.toFixed(0)}{' '}
              <span className="text-sm font-normal text-gray-600">/ month</span>
            </div>
            <div className="flex justify-center gap-6 text-xs text-gray-600 mt-3 pt-2 border-t border-blue-100">
              <span>Weekly: <strong className="text-gray-800">\${weeklyRepayment.toFixed(0)}</strong></span>
              <span>Fortnightly: <strong className="text-gray-800">\${fortnightlyRepayment.toFixed(0)}</strong></span>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Comparing available financing structures side-by-side using your current loan amount of{' '}
            <strong>\${loanAmount.toLocaleString()}</strong>:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-xs uppercase">
                  <th className="p-3">Loan Option</th>
                  <th className="p-3">Rate (%)</th>
                  <th className="p-3">Term</th>
                  <th className="p-3">Monthly Payment</th>
                  <th className="p-3">Total Interest</th>
                </tr>
              </thead>
              <tbody>
                {comparisonLoans.map((loan) => {
                  const monthly = calculateMonthlyRepayment(loan.interestRate, loan.loanTermYears);
                  const totalPayments = monthly * loan.loanTermYears * 12;
                  const totalInterest = Math.max(0, totalPayments - loanAmount);

                  return (
                    <tr key={loan.id} className="border-b border-gray-100 text-sm hover:bg-gray-50">
                      <td className="p-3 font-semibold text-gray-800">{loan.name}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          step="0.1"
                          value={loan.interestRate}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setComparisonLoans(
                              comparisonLoans.map((l) => (l.id === loan.id ? { ...l, interestRate: val } : l))
                            );
                          }}
                          className="w-16 p-1 border rounded text-sm bg-white"
                        />
                      </td>
                      <td className="p-3">
                        <select
                          value={loan.loanTermYears}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setComparisonLoans(
                              comparisonLoans.map((l) => (l.id === loan.id ? { ...l, loanTermYears: val } : l))
                            );
                          }}
                          className="p-1 border rounded text-sm bg-white"
                        >
                          <option value={15}>15 yr</option>
                          <option value={20}>20 yr</option>
                          <option value={25}>25 yr</option>
                          <option value={30}>30 yr</option>
                        </select>
                      </td>
                      <td className="p-3 font-bold text-blue-600">
                        \${monthly.toFixed(0)}
                      </td>
                      <td className="p-3 text-red-600 font-medium">
                        \${totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}