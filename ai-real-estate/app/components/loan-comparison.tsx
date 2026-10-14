"use client";

import React, { useState } from "react";
import { LoanOption, LoanComparisonResult } from "@/lib/mortgage-types";

interface LoanComparisonToolProps {
  defaultHomePrice?: number;
}

export default function LoanComparisonTool({ defaultHomePrice = 500000 }: LoanComparisonToolProps) {
  const [homePrice, setHomePrice] = useState<number>(defaultHomePrice);
  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(20);

  const loanAmount = homePrice * (1 - downPaymentPercent / 100);

  // Default comparison options pre-populated for the buyer
  const [loans, setLoans] = useState<LoanOption[]>([
    { id: "1", name: "30-Year Fixed (Standard)", loanAmount, interestRate: 7.40, termYears: 30 },
    { id: "2", name: "15-Year Fixed (Aggressive)", loanAmount, interestRate: 6.73, termYears: 15 },
    { id: "3", name: "5-Year Adjustable Rate", loanAmount, interestRate: 5.49, termYears: 30 },
  ]);

  // Calculation function for monthly P&I, total interest, and total cost
  const calculateLoan = (option: LoanOption): LoanComparisonResult => {
    const currentLoanAmount = homePrice * (1 - downPaymentPercent / 100);
    const monthlyRate = option.interestRate / 100 / 12;
    const numberOfPayments = option.termYears * 12;

    if (monthlyRate === 0) {
      return {
        id: option.id,
        name: option.name,
        monthlyPrincipalAndInterest: currentLoanAmount / numberOfPayments,
        totalPayments: currentLoanAmount,
        totalInterestPaid: 0,
        payoffTimeMonths: numberOfPayments,
      };
    }

    const monthlyPayment =
      (currentLoanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments))) /
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

    const totalPayments = monthlyPayment * numberOfPayments;
    const totalInterestPaid = totalPayments - currentLoanAmount;

    return {
      id: option.id,
      name: option.name,
      monthlyPrincipalAndInterest: monthlyPayment,
      totalPayments,
      totalInterestPaid,
      payoffTimeMonths: numberOfPayments,
    };
  };

  const results = loans.map(calculateLoan);

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 max-w-5xl mx-auto my-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Mortgage Loan Comparison Tool</h2>
      <p className="text-gray-600 text-sm mb-6">
        Compare different loan terms, structures, and rates side-by-side to understand your monthly obligations and long-term interest costs.
      </p>

      {/* Global Property Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Property Price ($)</label>
          <input
            type="number"
            value={homePrice}
            onChange={(e) => setHomePrice(Number(e.target.value))}
            className="w-full p-2 border rounded-md bg-white text-gray-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Down Payment (%)</label>
          <input
            type="number"
            value={downPaymentPercent}
            onChange={(e) => setDownPaymentPercent(Number(e.target.value))}
            className="w-full p-2 border rounded-md bg-white text-gray-800"
          />
        </div>
      </div>

      {/* Side-by-Side Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-700 text-sm">
              <th className="p-3">Loan Option</th>
              <th className="p-3">Interest Rate (%)</th>
              <th className="p-3">Term</th>
              <th className="p-3">Monthly Payment</th>
              <th className="p-3">Total Interest</th>
              <th className="p-3">Total Cost</th>
            </tr>
          </thead>
          <tbody>
            {results.map((res, idx) => {
              const loan = loans[idx];
              return (
                <tr key={res.id} className="border-b border-gray-100 hover:bg-gray-50 text-sm">
                  <td className="p-3 font-semibold text-gray-800">{res.name}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      step="0.01"
                      value={loan.interestRate}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLoans(loans.map(l => l.id === loan.id ? { ...l, interestRate: val } : l));
                      }}
                      className="w-20 p-1 border rounded bg-white text-gray-800"
                    />
                  </td>
                  <td className="p-3">
                    <select
                      value={loan.termYears}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLoans(loans.map(l => l.id === loan.id ? { ...l, termYears: val } : l));
                      }}
                      className="p-1 border rounded bg-white text-gray-800"
                    >
                      <option value={15}>15 Years</option>
                      <option value={20}>20 Years</option>
                      <option value={30}>30 Years</option>
                    </select>
                  </td>
                  <td className="p-3 font-bold text-blue-600">
                    ${res.monthlyPrincipalAndInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-red-600">
                    ${res.totalInterestPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="p-3 font-semibold text-gray-900">
                    ${res.totalPayments.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}