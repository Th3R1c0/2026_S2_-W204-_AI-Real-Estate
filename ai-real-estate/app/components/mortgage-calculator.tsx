"use client";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useState } from "react";
import { calculateMortgage } from "../../lib/mortgage-calculation";

interface MortgageCalculatorProps {
  defaultPrice?: number;
}
interface LoanOption {
  id: number;
  name: string;
  interestRate: number;
  loanTermYears: number;
}

const currency = (value: number) =>
  new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(value);

export default function MortgageCalculator({
  defaultPrice = 850000,
}: MortgageCalculatorProps) {
  const [propertyPrice, setPropertyPrice] = useState(defaultPrice);
  const [depositPercent, setDepositPercent] = useState(20);
  const [interestRate, setInterestRate] = useState(6.5);
  const [loanTermYears, setLoanTermYears] = useState(30);
  const [activeTab, setActiveTab] = useState<"calculator" | "compare">(
    "calculator",
  );
  const [comparisonLoans, setComparisonLoans] = useState<LoanOption[]>([
    { id: 1, name: "Option A", interestRate: 6.5, loanTermYears: 30 },
    { id: 2, name: "Option B", interestRate: 5.9, loanTermYears: 15 },
  ]);

  const priceValid = Number.isFinite(propertyPrice) && propertyPrice >= 0;
  const depositValid =
    Number.isFinite(depositPercent) &&
    depositPercent >= 0 &&
    depositPercent <= 100;
  const principal =
    priceValid && depositValid ? propertyPrice * (1 - depositPercent / 100) : 0;
  const calculation =
    priceValid && depositValid
      ? calculateMortgage(principal, interestRate, loanTermYears)
      : null;

  function updateLoan(id: number, update: Partial<LoanOption>) {
    setComparisonLoans((current) =>
      current.map((loan) => (loan.id === id ? { ...loan, ...update } : loan)),
    );
  }

  return (
    <div className="mortgage-tool">
      <div className="mortgage-tool-header">
        <div>
          <h3>Mortgage calculator</h3>
          <p>
            Explore repayments with your own price, deposit and interest rates.
          </p>
        </div>
        <ToggleGroup
          type="single"
          className="mortgage-mode"
          aria-label="Mortgage view"
          value={activeTab}
          onValueChange={(value) => {
            if (value) setActiveTab(value as "calculator" | "compare");
          }}
        >
          <ToggleGroupItem value="calculator">Calculator</ToggleGroupItem>
          <ToggleGroupItem value="compare">Compare loans</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <FieldGroup className="mortgage-inputs">
        <Field>
          <FieldLabel>
            Property price ($)
            <Input
              type="number"
              min="0"
              value={propertyPrice}
              onChange={(event) => setPropertyPrice(Number(event.target.value))}
            />
          </FieldLabel>
        </Field>
        <Field>
          <FieldLabel>
            Deposit percentage (%)
            <Input
              type="number"
              min="0"
              max="100"
              value={depositPercent}
              onChange={(event) =>
                setDepositPercent(Number(event.target.value))
              }
            />
          </FieldLabel>
        </Field>
        <div className="mortgage-loan-amount">
          <span>Deposit</span>
          <strong>
            {priceValid && depositValid
              ? currency(propertyPrice - principal)
              : "—"}
          </strong>
        </div>
        <div className="mortgage-loan-amount">
          <span>Loan amount</span>
          <strong>
            {priceValid && depositValid ? currency(principal) : "—"}
          </strong>
        </div>
      </FieldGroup>
      {(!priceValid || !depositValid) && (
        <p className="mortgage-error" role="alert">
          Enter a valid price and a deposit from 0% to 100%.
        </p>
      )}

      {activeTab === "calculator" ? (
        <div className="mortgage-calculator-body">
          <FieldGroup className="mortgage-rate-fields">
            <Field>
              <FieldLabel>
                Interest rate (%)
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={interestRate}
                  onChange={(event) =>
                    setInterestRate(Number(event.target.value))
                  }
                />
              </FieldLabel>
            </Field>
            <Field>
              <FieldLabel>
                Loan term (years)
                <NativeSelect
                  value={loanTermYears}
                  onChange={(event) =>
                    setLoanTermYears(Number(event.target.value))
                  }
                >
                  {[15, 20, 25, 30].map((year) => (
                    <option key={year} value={year}>
                      {year} years
                    </option>
                  ))}
                </NativeSelect>
              </FieldLabel>
            </Field>
          </FieldGroup>
          <div className="mortgage-result">
            <span>Estimated principal and interest</span>
            <strong data-testid="monthly-repayment">
              {calculation ? currency(calculation.monthlyPayment) : "—"}
              <small> / month</small>
            </strong>
            {calculation && (
              <p>
                About {currency((calculation.monthlyPayment * 12) / 52)} weekly
                · {currency((calculation.monthlyPayment * 12) / 26)} fortnightly
              </p>
            )}
          </div>
          {!calculation && (
            <p className="mortgage-error" role="alert">
              Enter a valid rate and loan term.
            </p>
          )}
        </div>
      ) : (
        <div className="mortgage-comparison">
          <p className="mortgage-help">
            Compare the same loan amount across fixed-rate examples. Change
            either rate or term to see the estimate update.
          </p>
          <div className="mortgage-options">
            {comparisonLoans.map((loan) => {
              const result =
                priceValid && depositValid
                  ? calculateMortgage(
                      principal,
                      loan.interestRate,
                      loan.loanTermYears,
                    )
                  : null;
              return (
                <article
                  className="mortgage-option"
                  data-testid="loan-option"
                  key={loan.id}
                >
                  <h4>{loan.name}</h4>
                  <FieldGroup className="mortgage-option-fields">
                    <Field>
                      <FieldLabel>
                        Interest rate (%)
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={loan.interestRate}
                          onChange={(event) =>
                            updateLoan(loan.id, {
                              interestRate: Number(event.target.value),
                            })
                          }
                        />
                      </FieldLabel>
                    </Field>
                    <Field>
                      <FieldLabel>
                        Loan term
                        <NativeSelect
                          value={loan.loanTermYears}
                          onChange={(event) =>
                            updateLoan(loan.id, {
                              loanTermYears: Number(event.target.value),
                            })
                          }
                        >
                          {[15, 20, 25, 30].map((year) => (
                            <option key={year} value={year}>
                              {year} years
                            </option>
                          ))}
                        </NativeSelect>
                      </FieldLabel>
                    </Field>
                  </FieldGroup>
                  <div className="mortgage-option-result">
                    <span>Estimated monthly repayment</span>
                    <strong data-testid="loan-repayment">
                      {result ? currency(result.monthlyPayment) : "—"}
                    </strong>
                  </div>
                  <div className="mortgage-option-total">
                    <span>Total interest over term</span>
                    <strong>
                      {result ? currency(result.totalInterest) : "—"}
                    </strong>
                  </div>
                  {!result && (
                    <p className="mortgage-error" role="alert">
                      Enter a valid rate and term.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}
      <p className="mortgage-disclaimer">
        Illustrative estimates only. Assumes a constant rate and monthly
        repayments; excludes fees, insurance and rate changes. Weekly and
        fortnightly figures are monthly equivalents, not separate payment
        schedules.
      </p>
    </div>
  );
}
