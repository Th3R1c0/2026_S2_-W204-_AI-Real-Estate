export interface LoanOption {
  id: string;
  name: string;
  loanAmount: number;
  interestRate: number; // Annual Percentage Rate (e.g., 6.5)
  termYears: number;
}

export interface LoanComparisonResult {
  id: string;
  name: string;
  monthlyPrincipalAndInterest: number;
  totalPayments: number;
  totalInterestPaid: number;
  payoffTimeMonths: number;
}