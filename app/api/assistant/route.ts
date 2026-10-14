import { NextResponse, type NextRequest } from "next/server";
import { authenticateOptional, getOrders, getProducts } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { generateShopAnswer, isGeminiConfigured } from "@/app/lib/gemini";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { readJsonBody } from "@/app/lib/request";
import {
  assistantReply,
  catalogueLine,
  groundingProducts,
} from "@/app/lib/assistant-rules";
import { buildSystemPrompt, parseAssistantAnswer, shopFacts } from "@/app/lib/assistant-prompt";
import { assistantMessageSchema, firstIssueMessage } from "@/app/lib/validation";
import { formatCurrency } from "@/app/lib/format";

export const runtime = "nodejs";

// The assistant answers shop questions from the catalogue and shop facts, and
// any other question from the model's own knowledge. The prompt and the answer
// clean-up live in app/lib/assistant-prompt.ts so they can be tested.

// getProducts() returns at most 100 rows per call, so reading the catalogue
// takes a few pages. It is public data, so one copy is shared for a minute
// instead of being re-read for every question.
const CATALOGUE_PAGE = 100;
const CATALOGUE_PAGES = 6;
const CATALOGUE_TTL_MS = 60_000;
let catalogueCache: { at: number; products: Awaited<ReturnType<typeof getProducts>> } | null = null;

async function loadCatalogue() {
  if (catalogueCache && Date.now() - catalogueCache.at < CATALOGUE_TTL_MS) {
    return catalogueCache.products;
  }

  const pages = await Promise.all(
    Array.from({ length: CATALOGUE_PAGES }, (_, index) =>
      getProducts({ inStock: true, limit: CATALOGUE_PAGE, offset: index * CATALOGUE_PAGE })
    )
  );
  const products = pages.flat();
  catalogueCache = { at: Date.now(), products };
  return products;
}

/** Only ever built from the signed-in caller's OWN orders. */
function orderContext(
  orders: { id: string; status: string; created_at: string; total_amount: number }[]
) {
  if (orders.length === 0) return "";

  const lines = orders.map(
    (order) =>
      `Order ${order.id.slice(0, 8)} | ${order.status} | placed ${new Date(
        order.created_at
      ).toISOString().slice(0, 10)} | ${formatCurrency(order.total_amount)}`
  );

  return ["", "Your recent orders:", ...lines].join("\n");
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, "assistant");

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many questions. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  try {
    const parsed = assistantMessageSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    const { message: question, history = [], language = "en" } = parsed.data;

    // Anonymous visitors may ask about products; order tracking additionally
    // needs a session, and getOrders() is scoped to that account, so one
    // customer can never read another's orders through the assistant.
    const viewer = await authenticateOptional(request);

    const [products, orders] = await Promise.all([
      loadCatalogue(),
      viewer && viewer.role !== "admin" && viewer.role !== "staff"
        ? getOrders(viewer, { limit: 5 }).catch(() => [])
        : Promise.resolve([]),
    ]);

    const rules = assistantReply(question, products);

    if (!isGeminiConfigured()) {
      return NextResponse.json({
        reply: rules.body,
        products: rules.products ?? [],
        source: "rules",
      });
    }

    try {
      const shortlist = groundingProducts(question, products);
      const answer = await generateShopAnswer({
        systemPrompt: buildSystemPrompt(language),
        history,
        question: [
          shopFacts(),
          "",
          "Catalogue (id | name | brand | category | price | key specs):",
          shortlist.map(catalogueLine).join("\n"),
          orderContext(
            orders as {
              id: string;
              status: string;
              created_at: string;
              total_amount: number;
            }[]
          ),
          "",
          `Customer question: ${question}`,
        ].join("\n"),
      });

      // Cards come from real catalogue rows. The ids the model named are kept
      // only when they were in the slice it was shown; otherwise the rule
      // engine's matches are used, so a made-up id can never become a link.
      const parsedAnswer = parseAssistantAnswer(answer, new Set(shortlist.map((item) => item.id)));
      const named = parsedAnswer.productIds
        .map((id) => shortlist.find((item) => item.id === id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      return NextResponse.json({
        reply: parsedAnswer.text || rules.body,
        products: named.length > 0 ? named : rules.products ?? [],
        source: "gemini",
      });
    } catch (aiError) {
      // Never fail the chat because an external provider is down or the free
      // quota ran out -- answer with the built-in rules instead.
      console.warn(
        "[assistant] Gemini unavailable, using built-in rules:",
        aiError instanceof Error ? aiError.message : aiError
      );

      return NextResponse.json({
        reply: rules.body,
        products: rules.products ?? [],
        source: "rules",
      });
    }
  } catch (error) {
    return handleRouteError("assistant.ask", error);
  }
}
