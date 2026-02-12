import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { applyRate, normalizeFxDay } from "@/server/services/fx-utils";

async function fetchHistoricalRate(baseCurrency: string, quoteCurrency: string, day: Date): Promise<{ rate: number; provider: string }> {
  const dayIso = day.toISOString().slice(0, 10);
  const isToday = dayIso === normalizeFxDay(new Date()).toISOString().slice(0, 10);

  if (!isToday) {
    const historicalUrl = `https://api.frankfurter.app/${dayIso}?from=${baseCurrency}&to=${quoteCurrency}`;
    const historicalResponse = await fetch(historicalUrl);
    if (historicalResponse.ok) {
      const payload = (await historicalResponse.json()) as { rates?: Record<string, number> };
      const historicalRate = payload.rates?.[quoteCurrency];
      if (historicalRate) {
        return { rate: historicalRate, provider: "frankfurter" };
      }
    }
  }

  const latestResponse = await fetch(`${env.FX_PROVIDER_URL}/${baseCurrency.toUpperCase()}`);
  if (!latestResponse.ok) {
    throw new Error("Unable to fetch FX rates");
  }

  const latestPayload = (await latestResponse.json()) as { rates?: Record<string, number> };
  const latestRate = latestPayload.rates?.[quoteCurrency.toUpperCase()];
  if (!latestRate) {
    throw new Error(`No FX rate for ${baseCurrency}/${quoteCurrency}`);
  }

  return { rate: latestRate, provider: env.FX_PROVIDER_URL };
}

export async function getOrFetchFxRate(baseCurrency: string, quoteCurrency: string, date: Date): Promise<number> {
  if (baseCurrency === quoteCurrency) return 1;

  const day = normalizeFxDay(date);
  const cached = await prisma.fXRate.findFirst({
    where: { baseCurrency, quoteCurrency, rateDate: day },
    orderBy: { createdAt: "desc" }
  });

  if (cached) {
    return Number(cached.rate);
  }

  const { rate, provider } = await fetchHistoricalRate(baseCurrency.toUpperCase(), quoteCurrency.toUpperCase(), day);

  await prisma.fXRate.create({
    data: {
      baseCurrency: baseCurrency.toUpperCase(),
      quoteCurrency: quoteCurrency.toUpperCase(),
      rate,
      rateDate: day,
      provider
    }
  });

  return rate;
}

export async function convertAmount(amount: number, fromCurrency: string, toCurrency: string, date: Date): Promise<number> {
  const rate = await getOrFetchFxRate(fromCurrency.toUpperCase(), toCurrency.toUpperCase(), date);
  return applyRate(amount, rate);
}
