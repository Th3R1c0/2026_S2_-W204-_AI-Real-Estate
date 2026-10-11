'use client';

import React, { useState } from 'react';

interface MortgageCalculatorProps {
  defaultPrice?: number;
}

export default function MortgageCalculator({ defaultPrice = 850000 }: MortgageCalculatorProps) {
  const [propertyPrice, setPropertyPrice] = useState<number>(defaultPrice);
  const [deposit, setDeposit] = useState<number>(defaultPrice * 0.2);
  const [interestRate, setInterestRate] = useState<number>(6.5);
  const [loanTermYears, setLoanTermYears] = useState<number>(30);

  const loanAmount = Math.max(0, propertyPrice - deposit);

  const calculateMonthlyRepayment = () => {
    if (loanAmount <= 0) return 0;
    const monthlyRate = interestRate / 100 / 12;
    const totalPayments = loanTermYears * 12;

    if (monthlyRate === 0) return loanAmount / totalPayments;

    const monthlyPayment =
      (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments))) /
      (Math.pow(1 + monthlyRate, totalPayments) - 1);

    return isNaN(monthlyPayment) ? 0 : monthlyPayment;
  };

  const monthlyRepayment = calculateMonthlyRepayment();
  const fortnightlyRepayment = (monthlyRepayment * 12) / 26;
  const weeklyRepayment = (monthlyRepayment * 12) / 52;

  return (
    <div className="p-6 bg-white rounded-xl shadow-md border border-gray-100 max-w-xl mx-auto my-6 text-gray-800">
      <h2 className="text-xl font-bold mb-4 text-gray-900">Mortgage Calculator</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Property Price ($)</label>
          <input
            type="number"
            value={propertyPrice}
            onChange={(e) => setPropertyPrice(Number(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Deposit ($)</label>
          <input
            type="number"
            value={deposit}
            onChange={(e) => setDeposit(Number(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg text-center border border-blue-100">
        <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider block">
          Estimated Repayment
        </span>
        <div className="text-3xl font-extrabold text-blue-900 my-1">
          ${monthlyRepayment.toFixed(0)}{' '}
          <span className="text-sm font-normal text-gray-600">/ month</span>
        </div>
        <div className="flex justify-center gap-6 text-xs text-gray-600 mt-3 pt-2 border-t border-blue-100">
          <span>Weekly: <strong className="text-gray-800">${weeklyRepayment.toFixed(0)}</strong></span>
          <span>Fortnightly: <strong className="text-gray-800">${fortnightlyRepayment.toFixed(0)}</strong></span>
        </div>
      </div>
    </div>
  );
}