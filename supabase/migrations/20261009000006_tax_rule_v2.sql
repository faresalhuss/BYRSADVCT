-- Georgia TAVT rule v2: rebates verified to reduce the base (Form MV-7D); lease basis = depreciation + amortized + cash down (MVD-2021-04).
insert into public.tax_rules (id, payload, active) values (
  'ga-tavt-2026-v2',
  '{
    "id": "ga-tavt-2026-v2", "state": "GA", "version": 2, "name": "Georgia TAVT", "rate": 0.07, "ratePrecision": 4,
    "tradeReducesBase": true, "rebatesReduceBase": true, "rebateRuleVerified": true,
    "taxableByCategory": {"dealer_fee": true, "dealer_addon": true, "gov_fee": false, "tax": false, "manufacturer_rebate": false, "conditional_rebate": false, "dealer_discount": false, "other": false},
    "sourceUrl": "https://dor.georgia.gov/document/document-document/mv-7d-state-and-local-title-ad-valorem-tax-fees/download",
    "verifiedOn": "2026-10-09",
    "notes": "Form MV-7D (rev. 1-2022): base = new vehicle retail sale price + other taxable fees (labor, freight, delivery, dealer fees, accessories, add-ons, mark-ups; not extended warranties) - manufacturer rebate - trade-in value. Rate 7% per O.C.G.A. 48-5C-1 and DOR bulletin MVD-2023-02. ELT and the $3 lemon-law fee are government charges and are left out of the base here.",
    "lease": {"name": "Georgia TAVT (lease)", "rate": 0.07, "basis": "depreciation", "includesCapReductions": true, "sourceUrl": "https://dor.georgia.gov/document/document/policy-bulletin-mvd-2021-04-revised-tavt-calculation-leases/download", "verifiedOn": "2026-10-09", "verified": true, "notes": "Since 2022-01-01 (HB 63, O.C.G.A. 48-5C-1(a)(1)(E)): base = total depreciation + amortized amounts + cash down payments; rebates, trade allowances and the rent charge are not taxed (Form MV-7L). Paid at signing or capitalized."}
  }'::jsonb, true) on conflict (id) do update set payload = excluded.payload, active = true;
update public.tax_rules set active = false where id <> 'ga-tavt-2026-v2';
update public.settings set payload = jsonb_set(payload, '{activeTaxRuleId}', '"ga-tavt-2026-v2"') where id = 1;
