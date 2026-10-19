import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import MortgageCalculator from "../app/components/mortgage-calculator";
import { calculateMortgage } from "../lib/mortgage-calculation";

describe("mortgage calculation", () => {
  it("matches a published $100,000, 4%, 30-year example", () => {
    expect(calculateMortgage(100_000, 4, 30)?.monthlyPayment).toBeCloseTo(
      477.42,
      2,
    );
  });

  it("repays a zero-interest loan in equal instalments", () => {
    expect(calculateMortgage(1_200, 0, 1)).toEqual({
      monthlyPayment: 100,
      totalPaid: 1_200,
      totalInterest: 0,
    });
  });

  it("rejects invalid loan inputs", () => {
    expect(calculateMortgage(100_000, -1, 30)).toBeNull();
    expect(calculateMortgage(100_000, 4, 0)).toBeNull();
  });
});

describe("mortgage comparison", () => {
  it("shows two editable loans and updates only the edited loan", async () => {
    const user = userEvent.setup();
    render(<MortgageCalculator defaultPrice={100_000} />);
    await user.click(screen.getByRole("radio", { name: /compare loans/i }));

    const options = screen.getAllByTestId("loan-option");
    expect(options).toHaveLength(2);
    const firstBefore = within(options[0]).getByTestId(
      "loan-repayment",
    ).textContent;
    const secondBefore = within(options[1]).getByTestId(
      "loan-repayment",
    ).textContent;
    await user.clear(
      within(options[0]).getByRole("spinbutton", { name: /interest rate/i }),
    );
    await user.type(
      within(options[0]).getByRole("spinbutton", { name: /interest rate/i }),
      "8",
    );
    expect(
      within(options[0]).getByTestId("loan-repayment").textContent,
    ).not.toBe(firstBefore);
    expect(within(options[1]).getByTestId("loan-repayment").textContent).toBe(
      secondBefore,
    );
  });
});
