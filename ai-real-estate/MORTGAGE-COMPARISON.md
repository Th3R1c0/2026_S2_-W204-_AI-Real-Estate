# Mortgage loan comparison

**Story:** As a buyer, I want to compare two mortgage options so I can see how their rates and terms change my estimated repayments.

## Simple acceptance tests

1. Given a property price and deposit, when I open **Compare loans**, I see two options side by side with each option's rate, term, monthly repayment and total interest.
2. When I change either option's rate or term, its estimate updates immediately; the other option stays the same.
3. Invalid price, deposit or rate values show an error rather than a misleading repayment.

## How the estimate works

Loan amount = property price − deposit. For a fixed annual rate, monthly rate `r = annual rate / 12`, months `n = years × 12`, and monthly principal-and-interest payment `M = P × r / (1 − (1 + r)^−n)`, where `P` is the loan amount. At 0% interest, `M = P / n`. Total interest = `M × n − P`.

**Check:** A $100,000 loan at 4% for 30 years gives **$477.42 per month** (displayed as $477). This matches the [Consumer Financial Protection Bureau's published example](https://www.consumerfinance.gov/ask-cfpb/how-do-mortgage-lenders-calculate-monthly-payments-en-1965/), which rounds it to $477. The automated test also checks this example, the 0% case, invalid inputs and whether editing one option updates only that option.

These are estimates for a constant rate and monthly payments. Fees, insurance, rate changes and lender-specific rules are excluded. Weekly and fortnightly numbers are monthly equivalents, not independently calculated repayment schedules.
