import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@financeflow.local";
  const passwordHash = await bcrypt.hash("DemoPass123!", 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      baseCurrency: "NGN"
    }
  });

  const [gtb, wise, cash] = await Promise.all([
    prisma.account.upsert({
      where: { userId_name: { userId: user.id, name: "GTBank Naira" } },
      update: {},
      create: { userId: user.id, name: "GTBank Naira", currency: "NGN", institution: "GTBank" }
    }),
    prisma.account.upsert({
      where: { userId_name: { userId: user.id, name: "Wise USD" } },
      update: {},
      create: { userId: user.id, name: "Wise USD", currency: "USD", institution: "Wise" }
    }),
    prisma.account.upsert({
      where: { userId_name: { userId: user.id, name: "Cash Naira" } },
      update: {},
      create: { userId: user.id, name: "Cash Naira", currency: "NGN", institution: "Cash" }
    })
  ]);

  const feeding = await prisma.category.upsert({
    where: { userId_slug: { userId: user.id, slug: "feeding" } },
    update: {},
    create: { userId: user.id, name: "Feeding", slug: "feeding", level: 1 }
  });

  const accommodation = await prisma.category.upsert({
    where: { userId_slug: { userId: user.id, slug: "accommodation" } },
    update: {},
    create: { userId: user.id, name: "Accommodation", slug: "accommodation", level: 1 }
  });

  const savings = await prisma.category.upsert({
    where: { userId_slug: { userId: user.id, slug: "savings" } },
    update: {},
    create: { userId: user.id, name: "Savings", slug: "savings", level: 1 }
  });

  const rice = await prisma.category.upsert({
    where: { userId_slug: { userId: user.id, slug: "rice" } },
    update: {},
    create: { userId: user.id, name: "Rice", slug: "rice", level: 2, parentId: feeding.id }
  });

  const fish = await prisma.category.upsert({
    where: { userId_slug: { userId: user.id, slug: "fish" } },
    update: {},
    create: { userId: user.id, name: "Fish", slug: "fish", level: 2, parentId: feeding.id }
  });

  const uncategorized = await prisma.category.upsert({
    where: { userId_slug: { userId: user.id, slug: "uncategorized" } },
    update: { isSystem: true, level: 1, parentId: null },
    create: { userId: user.id, name: "Uncategorized", slug: "uncategorized", level: 1, isSystem: true }
  });

  await prisma.classificationRule.createMany({
    data: [
      { userId: user.id, categoryId: rice.id, keyword: "rice", priority: 10 },
      { userId: user.id, categoryId: fish.id, keyword: "fish", priority: 10 },
      { userId: user.id, categoryId: accommodation.id, keyword: "rent", priority: 10 },
      { userId: user.id, categoryId: savings.id, keyword: "transfer to savings", priority: 5 }
    ],
    skipDuplicates: true
  });

  await prisma.transaction.createMany({
    data: [
      {
        userId: user.id,
        accountId: gtb.id,
        categoryId: rice.id,
        direction: "EXPENSE",
        description: "Supermarket rice",
        merchantName: "Shoprite",
        amountOriginal: 18000,
        originalCurrency: "NGN",
        amountBase: 18000,
        baseCurrency: "NGN",
        transactionDate: new Date("2026-02-02")
      },
      {
        userId: user.id,
        accountId: cash.id,
        categoryId: fish.id,
        direction: "EXPENSE",
        description: "Fresh fish",
        merchantName: "Mile 12 Market",
        amountOriginal: 6200,
        originalCurrency: "NGN",
        amountBase: 6200,
        baseCurrency: "NGN",
        transactionDate: new Date("2026-02-04")
      },
      {
        userId: user.id,
        accountId: wise.id,
        categoryId: savings.id,
        direction: "INCOME",
        description: "Client payment",
        merchantName: "Upwork",
        amountOriginal: 950,
        originalCurrency: "USD",
        amountBase: 1434500,
        baseCurrency: "NGN",
        transactionDate: new Date("2026-02-06")
      }
    ],
    skipDuplicates: true
  });

  const [essential, groceries] = await Promise.all([
    prisma.tag.upsert({
      where: { userId_name: { userId: user.id, name: "Essential" } },
      update: {},
      create: { userId: user.id, name: "Essential", color: "#005f73" }
    }),
    prisma.tag.upsert({
      where: { userId_name: { userId: user.id, name: "Groceries" } },
      update: {},
      create: { userId: user.id, name: "Groceries", color: "#0a9396" }
    })
  ]);

  const tx = await prisma.transaction.findFirst({
    where: { userId: user.id, categoryId: rice.id },
    orderBy: { transactionDate: "desc" },
    include: { lineItems: true }
  });

  if (tx) {
    await prisma.transactionTag.upsert({
      where: { transactionId_tagId: { transactionId: tx.id, tagId: groceries.id } },
      update: {},
      create: { transactionId: tx.id, tagId: groceries.id }
    });
    await prisma.transactionTag.upsert({
      where: { transactionId_tagId: { transactionId: tx.id, tagId: essential.id } },
      update: {},
      create: { transactionId: tx.id, tagId: essential.id }
    });
  }

  // eslint-disable-next-line no-console
  console.log("Seeded demo user:", email, "password: DemoPass123!");
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
