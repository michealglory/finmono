export const statementPrompt = `
You extract bank statement transactions into strict JSON.
Rules:
- Output only transactions actually present.
- Keep amounts positive and set direction explicitly (INCOME/EXPENSE).
- Preserve original currency code if present.
- Merchant names should be concise.
- If unknown fields, set null.
`;

export const receiptPrompt = `
You extract receipt details into strict JSON.
Rules:
- The total must reflect the final amount paid.
- Currency should be ISO code.
- Do not invent values not on receipt.
`;
