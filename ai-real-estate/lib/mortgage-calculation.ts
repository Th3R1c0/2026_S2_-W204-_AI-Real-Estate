export interface MortgageResult {
  monthlyPayment: number;
  totalPaid: number;
  totalInterest: number;
}

/** Standard level-payment amortisation, assuming a fixed annual rate and monthly payments. */
export function calculateMortgage(principal: number, annualRatePercent: number, termYears: number): MortgageResult | null {
  if (!Number.isFinite(principal) || principal < 0 || !Number.isFinite(annualRatePercent) || annualRatePercent < 0 || !Number.isFinite(termYears) || termYears <= 0) return null;
  const paymentCount = termYears * 12;
  const monthlyRate = annualRatePercent / 1200;
  const monthlyPayment = principal === 0 ? 0 : monthlyRate === 0
    ? principal / paymentCount
    : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -paymentCount));
  const totalPaid = monthlyPayment * paymentCount;
  return { monthlyPayment, totalPaid, totalInterest: Math.max(0, totalPaid - principal) };
}
