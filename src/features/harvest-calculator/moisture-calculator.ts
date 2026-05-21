export type MoistureCalculatorVerdict = 'worth_it' | 'similar' | 'not_worth_it';

export type MoistureCalculatorInput = {
  moistureCurrent: number;
  moistureTarget: number;
  weightKg: number;
  priceCurrentPerKg: number;
  priceTargetPerKg: number;
  dryingCostBaht?: number;
};

export type MoistureCalculatorResult = {
  ok: boolean;
  errors?: Partial<Record<keyof MoistureCalculatorInput, string>>;
  values?: {
    weightAfterKg: number;
    weightLossKg: number;
    currentGrossBaht: number;
    targetGrossBaht: number;
    targetNetBaht: number;
    deltaBaht: number;
    deltaBahtPerTon: number;
    verdict: MoistureCalculatorVerdict;
  };
};

export function calculateMoistureValue(input: MoistureCalculatorInput): MoistureCalculatorResult {
  const dryingCostBaht = input.dryingCostBaht ?? 0;
  const errors: Partial<Record<keyof MoistureCalculatorInput, string>> = {};

  if (!(input.moistureCurrent > 0 && input.moistureCurrent <= 50)) errors.moistureCurrent = 'must be > 0 and <= 50';
  if (!(input.moistureTarget > 0 && input.moistureTarget <= 50)) errors.moistureTarget = 'must be > 0 and <= 50';
  if (input.moistureTarget >= input.moistureCurrent) errors.moistureTarget = 'must be less than moistureCurrent';
  if (!(input.weightKg > 0)) errors.weightKg = 'must be > 0';
  if (!(input.priceCurrentPerKg > 0)) errors.priceCurrentPerKg = 'must be > 0';
  if (!(input.priceTargetPerKg > 0)) errors.priceTargetPerKg = 'must be > 0';
  if (!(dryingCostBaht >= 0)) errors.dryingCostBaht = 'must be >= 0';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const weightAfterKg = input.weightKg * (100 - input.moistureCurrent) / (100 - input.moistureTarget);
  const weightLossKg = input.weightKg - weightAfterKg;
  const currentGrossBaht = input.weightKg * input.priceCurrentPerKg;
  const targetGrossBaht = weightAfterKg * input.priceTargetPerKg;
  const targetNetBaht = targetGrossBaht - dryingCostBaht;
  const deltaBaht = targetNetBaht - currentGrossBaht;
  const deltaBahtPerTon = (deltaBaht / input.weightKg) * 1000;
  const verdict: MoistureCalculatorVerdict =
    deltaBahtPerTon > 500 ? 'worth_it' : deltaBahtPerTon < -500 ? 'not_worth_it' : 'similar';

  return {
    ok: true,
    values: { weightAfterKg, weightLossKg, currentGrossBaht, targetGrossBaht, targetNetBaht, deltaBaht, deltaBahtPerTon, verdict },
  };
}
