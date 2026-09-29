import { u as _e, r as i, s as x, j as e, L as Ce } from "./index-vaWnYKxf.js";
import { c as he, f as we, g as ke, n as Ne } from "./membership-BI3ZslQk.js";
import { priceService, priceLabel, repairKitDiscount, vehicleLabels, catalogEntry, catalogVersion, normalizeServiceName } from "./vehicle-pricing.js";
const ee = "[ghost-lab-bill]";
const POS_DRAFT_PREFIX = "ghostlab-pos-draft:";
function readPosDraft(key) {
  try {
    const draft = JSON.parse(sessionStorage.getItem(key) || "null");
    return draft && typeof draft === "object" ? draft : null;
  } catch {
    return null;
  }
}
const chillMenuVisuals = new Map([
  ["SABI UNAGI", "/assets/sabinagisa-unagi.png"],
  ["SABI NAGI HIGHBALL", "/assets/sabinagisa-nagi-highball.png"],
  ["SABI YORU UME", "/assets/sabinagisa-yoru-ume.png"],
  ["WHIPPED FETA & TOAST", "/assets/sabinagisa-whipped-feta-toast.png"],
  ["GRAPEFRUIT HONEY SODA", "/assets/sabinagisa-grapefruit-honey-soda.png"],
  ["BEER-BATTERED FISH BITES", "/assets/sabinagisa-fish-bites.png"]
].map(([name, image]) => [normalizeServiceName(name), image]));
const obsoleteChillServices = new Set(["iced matcha", "ramen ghost special"]);
const chillMenuImage = service => service.image_url || "";
const visibleService = (service, branchKey) => branchKey !== "chill" || !obsoleteChillServices.has(normalizeServiceName(service.name));
const sabinagisaMenu = [{ name: "SABI UNAGI", category: "Main" }, { name: "SABI NAGI HIGHBALL", category: "Water" }, { name: "SABI YORU UME", category: "Dessert" }, { name: "WHIPPED FETA & TOAST", category: "Main" }, { name: "GRAPEFRUIT HONEY SODA", category: "Water" }, { name: "BEER-BATTERED FISH BITES", category: "Dessert" }];
function ye(n, a = "\u0E17\u0E33\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48") {
  const p = String((n == null ? void 0 : n.message) || "").toLowerCase();
  return (n == null ? void 0 : n.code) === "23505" || p.includes("duplicate") ? "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E19\u0E35\u0E49\u0E16\u0E39\u0E01\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E1B\u0E41\u0E25\u0E49\u0E27 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E35\u0E40\u0E1F\u0E23\u0E0A\u0E01\u0E48\u0E2D\u0E19\u0E17\u0E33\u0E0B\u0E49\u0E33" : (n == null ? void 0 : n.code) === "42501" || p.includes("permission") || p.includes("policy") ? "\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E19\u0E35\u0E49\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E17\u0E33\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23" : p.includes("jwt") || p.includes("session") ? "\u0E40\u0E0B\u0E2A\u0E0A\u0E31\u0E19\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E2D\u0E2D\u0E01\u0E41\u0E25\u0E49\u0E27\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E43\u0E2B\u0E21\u0E48" : p.includes("fetch") || p.includes("network") ? "\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E10\u0E32\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E23\u0E27\u0E08\u0E2D\u0E34\u0E19\u0E40\u0E17\u0E2D\u0E23\u0E4C\u0E40\u0E19\u0E47\u0E15\u0E41\u0E25\u0E49\u0E27\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48" : p.includes("stock") || p.includes("quantity") ? "\u0E2A\u0E15\u0E4A\u0E2D\u0E01\u0E44\u0E21\u0E48\u0E40\u0E1E\u0E35\u0E22\u0E07\u0E1E\u0E2D\u0E2B\u0E23\u0E37\u0E2D\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E15\u0E4A\u0E2D\u0E01\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E2A\u0E15\u0E4A\u0E2D\u0E01" : p.includes("bill not found") ? "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E1A\u0E34\u0E25\u0E19\u0E35\u0E49 \u0E2D\u0E32\u0E08\u0E16\u0E39\u0E01\u0E41\u0E01\u0E49\u0E44\u0E02\u0E2B\u0E23\u0E37\u0E2D\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E44\u0E1B\u0E41\u0E25\u0E49\u0E27" : a;
}
function Be(n, a, vehicleClass = null) {
  const p = a.map(v => ({
    name_snapshot: v.name,
    price_snapshot: v.price
  }));
  return ee + JSON.stringify({
    note: n.trim() || null,
    items: p,
    ...(vehicleClass && { vehicle_class: vehicleClass, pricing_catalog: catalogVersion })
  });
}
function ze(n) {
  if (!(n != null && n.startsWith(ee))) return {
    note: n || "",
    items: []
  };
  try {
    const a = JSON.parse(n.slice(ee.length));
    return {
      note: a.note || "",
      items: Array.isArray(a.items) ? a.items : [],
      vehicleClass: Object.hasOwn(vehicleLabels, a.vehicle_class) ? a.vehicle_class : null
    };
  } catch {
    return {
      note: "",
      items: []
    };
  }
}
function $e({
  branchKey: n,
  title: a,
  leadRole: p,
  restaurantMode: v = false
}) {
  const {
      staff: g
    } = _e(),
    [h, b] = i.useState(null),
    [y, j] = i.useState("bill"),
    [k, u] = i.useState(0),
    [m, l] = i.useState(0),
    o = ["owner", "god", "ceo"].includes(g == null ? void 0 : g.role);
  return i.useEffect(() => {
    x.from("branches").select("*").eq("key", n).single().then(({
      data: s,
      error: r
    }) => {
      r && console.error("[Ghost Lab] Failed to load branch:", r), b(s);
    });
  }, [n]), i.useEffect(() => {
    h && (x.from("bills").select("id", {
      count: "exact",
      head: true
    }).eq("branch_id", h.id).then(({
      count: s
    }) => u(s || 0)), x.from("services").select("id,name").eq("branch_id", h.id).eq("active", true).then(({
      data: s
    }) => l((s || []).filter(service => visibleService(service, n)).length)));
  }, [h, y]), h ? e.jsxs("div", {
    children: [e.jsxs("div", {
      className: "panel pos-hero",
      style: {
        background: "linear-gradient(120deg, rgba(196,30,42,0.14), transparent 60%), var(--static)",
        padding: "20px 24px",
        marginBottom: 18,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12
      },
      children: [e.jsxs("div", {
        children: [e.jsx("div", {
          className: "font-display",
          style: {
            fontSize: 20,
            fontWeight: 600
          },
          children: v ? "SABINAGISA" : h.name
        }), e.jsxs("div", {
          style: {
            fontSize: 12,
            color: "var(--ghost-gray)",
            marginTop: 2
          },
          children: ["SERVICE BILL \xB7 COMMISSION \xA5", h.commission_flat.toLocaleString(), " ", "/ BILL \xB7 ", m, " SERVICES"]
        })]
      }), e.jsxs("div", {
        className: "pos-tabs",
        style: {
          display: "flex",
          gap: 8
        },
        children: [e.jsx(K, {
          active: y === "bill",
          onClick: () => j("bill"),
          children: "New Bill"
        }), e.jsxs(K, {
          active: y === "history",
          onClick: () => j("history"),
          children: ["Bills (", k, ")"]
        }), o && e.jsxs(K, {
          active: y === "services",
          onClick: () => j("services"),
          children: ["Services (", m, ")"]
        })]
      })]
    }), y === "bill" && e.jsx(Le, {
      branch: h,
      title: a,
      staff: g,
      restaurantMode: v
    }), y === "history" && e.jsx(Ee, {
      branch: h,
      staff: g,
      onBillDeleted: () => u(s => Math.max(0, s - 1))
    }), y === "services" && o && e.jsx(Re, {
      branch: h
    })]
  }) : e.jsx("div", {
    style: {
      color: "var(--ghost-gray)"
    },
    children: "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E42\u0E2B\u0E25\u0E14..."
  });
}
function K({
  active: n,
  onClick: a,
  children: p
}) {
  return e.jsx("div", {
    onClick: a,
    className: "btn",
    style: {
      fontSize: 12,
      background: n ? "var(--bone)" : "rgba(255,255,255,0.03)",
      color: n ? "var(--void)" : "var(--ghost-gray)",
      borderColor: n ? "var(--bone)" : "var(--line)",
      fontWeight: n ? 600 : 400
    },
    children: p
  });
}
function Le({
  branch: n,
  title: a,
  staff: p,
  restaurantMode: v
}) {
  const draftStorageKey = `${POS_DRAFT_PREFIX}${n.key}:${(p == null ? void 0 : p.id) || "guest"}`;
  const initialDraft = readPosDraft(draftStorageKey);
  const [g, h] = i.useState([]),
    [b, y] = i.useState("all"),
    [j, k] = i.useState(""),
    [cartSelection, m] = i.useState(() => Array.isArray(initialDraft == null ? void 0 : initialDraft.cart) ? initialDraft.cart : []),
    [l, o] = i.useState(() => (initialDraft == null ? void 0 : initialDraft.plate) || ""),
    [s, r] = i.useState(() => (initialDraft == null ? void 0 : initialDraft.vehicle) || ""),
    [c, S] = i.useState(() => (initialDraft == null ? void 0 : initialDraft.notes) || ""),
    [f, w] = i.useState(false),
    z = i.useRef(false),
    [R, A] = i.useState(""),
    [M, te] = i.useState(() => Boolean(initialDraft == null ? void 0 : initialDraft.selfService)),
    [E, ne] = i.useState(() => Boolean(initialDraft == null ? void 0 : initialDraft.memberEnabled)),
    [q, se] = i.useState(() => (initialDraft == null ? void 0 : initialDraft.orderType) || "dine_in"),
    [H, ie] = i.useState(() => (initialDraft == null ? void 0 : initialDraft.table) || new URLSearchParams(window.location.search).get("table") || ""),
    [$, re] = i.useState(() => (initialDraft == null ? void 0 : initialDraft.paymentMethod) || "transfer"),
    [I, oe] = i.useState(() => (initialDraft == null ? void 0 : initialDraft.amountReceived) || ""),
    [T, G] = i.useState(""),
    [ae, D] = i.useState([]),
    [C, P] = i.useState(null),
    [fe, Q] = i.useState(false),
    [U, le] = i.useState([]),
    [ce, J] = i.useState(false),
    [vehicleClass, setVehicleClass] = i.useState("standard");
  i.useEffect(() => {
    try {
      if (!cartSelection.length && !l && !s && !c && !M && !E) {
        sessionStorage.removeItem(draftStorageKey);
        return;
      }
      sessionStorage.setItem(draftStorageKey, JSON.stringify({ cart: cartSelection, plate: l, vehicle: s, notes: c, selfService: M, memberEnabled: E, orderType: q, table: H, paymentMethod: $, amountReceived: I }));
    } catch {}
  }, [cartSelection, l, s, c, M, E, q, H, $, I, draftStorageKey]);
  const u = cartSelection.map(item => priceService(g.find(service => service.id === item.id) || item, vehicleClass, n.key));
  const pricingBlocked = u.some(item => item.pricingError);
  i.useEffect(() => {
    x.from("services").select("*").eq("branch_id", n.id).eq("active", true).then(({
      data: t,
      error: d
    }) => {
      d && console.error(d), h((t || []).filter(service => visibleService(service, n.key)));
    });
  }, [n]), i.useEffect(() => {
    if (!T.trim()) {
      D([]);
      return;
    }
    const t = setTimeout(async () => {
      const {
        data: d,
        error: _
      } = await x.from("members").select("*").eq("branch_id", n.id).or(`name.ilike.%${T}%,plate_or_note.ilike.%${T}%,phone.ilike.%${T}%`).limit(5);
      _ && console.error(_), D(d || []);
    }, 250);
    return () => clearTimeout(t);
  }, [T, n]), i.useEffect(() => {
    if (J(false), !C) {
      le([]);
      return;
    }
    x.from("member_rewards").select("id").eq("member_id", C.id).eq("status", "available").order("created_at").then(({
      data: t,
      error: d
    }) => {
      d && console.error(d), le(t || []);
    });
  }, [C]), i.useEffect(() => {
    if (!u.length) return;
    const t = "\u0E22\u0E31\u0E07\u0E21\u0E35\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E15\u0E30\u0E01\u0E23\u0E49\u0E32 \u0E2B\u0E32\u0E01\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E2B\u0E19\u0E49\u0E32\u0E19\u0E35\u0E49\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E08\u0E30\u0E2B\u0E32\u0E22\u0E44\u0E1B",
      d = B => {
        B.preventDefault(), B.returnValue = t;
      },
      _ = B => {
        var L, ue;
        ((ue = (L = B.target).closest) == null ? void 0 : ue.call(L, "a[href]")) && !window.confirm(t) && (B.preventDefault(), B.stopPropagation());
      };
    return window.addEventListener("beforeunload", d), document.addEventListener("click", _, true), () => {
      window.removeEventListener("beforeunload", d), document.removeEventListener("click", _, true);
    };
  }, [u.length]);
  const xe = ["all", ...new Set(g.map(t => t.category))],
    X = (b === "all" ? g : g.filter(t => t.category === b)).filter(t => visibleService(t, n.key)).filter(t => {
      const d = j.trim().toLowerCase();
      return !d || t.name.toLowerCase().includes(d) || t.category.toLowerCase().includes(d);
    }).map(t => priceService(t, vehicleClass, n.key)).filter(t => vehicleClass !== "supercar" || !t.pricingError),
    W = u.reduce((t, d) => t + (d.price ?? 0), 0),
    ve = Object.values(u.reduce((t, d) => {
      const _ = t[d.id];
      return t[d.id] = _ ? {
        ..._,
        quantity: _.quantity + 1,
        lineTotal: _.lineTotal + (d.price ?? 0)
      } : {
        ...d,
        quantity: 1,
        lineTotal: d.price ?? 0
      }, t;
    }, {})),
    K2 = C && E ? he(C, W, n.key) : {
      active: false,
      percentage: 0,
      amount: 0,
      total: W
    },
    F = repairKitDiscount(u, K2.active, n.key),
    Pe = Math.max(0, W - F),
    N = C && E ? he(C, Pe, n.key) : {
      active: false,
      percentage: 0,
      amount: 0,
      total: Pe
    },
    Y = F > 0,
    de = !!(ce && U[0]),
    Z = Y || de,
    O = M || de ? 0 : N.total,
    pe = M ? 0 : n.commission_flat;
  function me(t) {
    const service = g.find(item => item.id === t.id);
    if (!service || f) return;
    const priced = priceService(service, vehicleClass, n.key);
    if (priced.pricingError) return V(priced.pricingError);
    m(d => [...d, service]);
  }
  function be(t) {
    m(d => {
      const _ = d.findIndex(B => B.id === t);
      return _ === -1 ? d : d.filter((B, F2) => F2 !== _);
    });
  }
  function V(t) {
    A(t), setTimeout(() => A(""), 3200);
  }
  function ge(t) {
    P(t), G(""), D([]), t.plate_or_note && o(t.plate_or_note);
  }
  function je() {
    ne(t => (t && (P(null), G(""), D([])), !t));
  }
  function selectVehicleClass(nextClass) {
    if (nextClass === vehicleClass || f) return;
    if (nextClass === "supercar") {
      const unavailable = cartSelection.filter(item => priceService(g.find(service => service.id === item.id) || item, nextClass, n.key).pricingError);
      if (unavailable.length) {
        const unavailableIds = new Set(unavailable.map(item => item.id));
        m(items => items.filter(item => !unavailableIds.has(item.id)));
        V(`นำรายการที่ไม่มีราคา Super Car ออกจากตะกร้าแล้ว ${unavailable.length} ชิ้น`);
      }
    }
    setVehicleClass(nextClass);
  }
  async function Se() {
    if (u.length === 0 || !p || z.current) return;
    if (pricingBlocked) return V("มีรายการที่ยังไม่มีราคา กรุณาตรวจสอบตะกร้าก่อนบันทึก");
    if (E && !C) {
      V("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01 Member \u0E01\u0E48\u0E2D\u0E19\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E1A\u0E34\u0E25");
      return;
    }
    if (v && q === "dine_in" && !H.trim() && !window.confirm("\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E23\u0E30\u0E1A\u0E38\u0E42\u0E15\u0E4A\u0E30 \u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E2B\u0E19\u0E49\u0E32\u0E23\u0E49\u0E32\u0E19\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48?")) return;
    z.current = true, w(true);
    const t = `${n.key.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
      {
        data: d,
        error: _
      } = await x.from("bills").insert({
        bill_number: t,
        branch_id: n.id,
        staff_id: p.id,
        member_id: (C == null ? void 0 : C.id) || null,
        plate: l || null,
        vehicle: s || null,
        notes: Be(c, u, n.key === "garage" ? vehicleClass : null),
        subtotal: W,
        discount_pct: M ? 0 : de ? 100 : N.percentage,
        commission: pe,
        commission_mode: n.key === "chill" ? "ON_WORK_ALL" : "INDIVIDUAL",
        total: O,
        status: "paid",
        order_type: v ? q : null,
        table_number: v && q === "dine_in" && H.trim() || null,
        kitchen_status: v ? "received" : null,
        payment_method: $,
        amount_received: $ === "cash" && I !== "" ? Number(I) : null,
        change_due: $ === "cash" && I !== "" ? Math.max(0, Number(I) - O) : 0
      }).select().single();
    if (_) {
      console.error(_), V(ye(_, "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E1A\u0E34\u0E25\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48")), z.current = false, w(false);
      return;
    }
    const B = u.map(L => ({
        bill_id: d.id,
        service_id: L.id,
        name_snapshot: L.name,
        price_snapshot: L.price
      })),
      {
        error: F2
      } = await x.from("bill_items").insert(B);
    if (F2) {
      console.error(F2), V(`\u0E1A\u0E34\u0E25 ${t} \u0E16\u0E39\u0E01\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E41\u0E25\u0E49\u0E27 \u0E41\u0E15\u0E48\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E44\u0E21\u0E48\u0E04\u0E23\u0E1A \u0E01\u0E23\u0E38\u0E13\u0E32\u0E41\u0E08\u0E49\u0E07\u0E1C\u0E39\u0E49\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23`), z.current = false, w(false);
      return;
    }
    if (C && (await x.from("members").update({
      total_spent: (C.total_spent || 0) + O,
      visits: (C.visits || 0) + 1
    }).eq("id", C.id)), de) {
      const {
        error: L
      } = await x.from("member_rewards").update({
        status: "redeemed",
        redeemed_bill_id: d.id,
        redeemed_at: (/* @__PURE__ */new Date()).toISOString()
      }).eq("id", U[0].id).eq("status", "available");
      L && console.error(L);
    }
    setVehicleClass("standard");
    m([]), o(""), r(""), S(""), P(null), te(false), ne(false), J(false), ie(""), oe(""), V("\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E1A\u0E34\u0E25\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u2713 " + t), z.current = false, w(false);
  }
  return e.jsxs("div", {
    children: [n.key === "garage" && e.jsxs("section", {
      "aria-label": "ประเภทรถและราคา",
      className: "panel",
      style: { marginBottom: 16 },
      children: [e.jsxs("div", {
        style: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 },
        children: [e.jsx("strong", { children: "ประเภทรถ" }), ...Object.entries(vehicleLabels).map(([key, label]) => e.jsx("button", {
          type: "button",
          className: `btn ${vehicleClass === key ? "btn-primary" : "btn-secondary"}`,
          "aria-pressed": vehicleClass === key,
          disabled: f,
          onClick: () => selectVehicleClass(key),
          children: label
        }, key))]
      }), e.jsx("p", {
        style: { color: "var(--ghost-gray)", fontSize: 12, margin: "10px 0 0" },
        children: "Member ที่ยังไม่หมดอายุ: Engine Repair Kit และ Full Repair Kit ฟรีทั้ง Standard และ Super Car · อะไหล่อื่นคิดตามประเภทที่เลือก"
      })]
    }), e.jsxs("div", {
      className: "pos-layout",
      style: {
        display: "grid",
        gridTemplateColumns: "1.6fr 1fr",
        gap: 16,
        alignItems: "start"
      },
      children: [e.jsxs("div", {
        children: [e.jsxs("div", {
          style: {
            alignItems: "center",
            display: "flex",
            gap: 8,
            marginBottom: 12
          },
          children: [e.jsxs("div", {
            style: {
              alignItems: "center",
              background: "rgba(255,255,255,.035)",
              border: "1px solid var(--line)",
              borderRadius: 6,
              display: "flex",
              flex: 1,
              padding: "0 10px"
            },
            children: [e.jsx("span", {
              style: {
                color: "var(--ghost-gray)",
                fontSize: 16
              },
              children: "\u2315"
            }), e.jsx("input", {
              className: "input",
              value: j,
              onChange: t => k(t.target.value),
              placeholder: "\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23 \u0E40\u0E0A\u0E48\u0E19 Tire, Repair, Bumper...",
              style: {
                background: "transparent",
                border: 0,
                padding: "10px 8px"
              }
            }), j && e.jsx("button", {
              type: "button",
              onClick: () => k(""),
              "aria-label": "\u0E25\u0E49\u0E32\u0E07\u0E04\u0E33\u0E04\u0E49\u0E19",
              style: {
                background: "transparent",
                border: 0,
                color: "var(--ghost-gray)",
                cursor: "pointer",
                fontSize: 17
              },
              children: "\xD7"
            })]
          }), e.jsxs("span", {
            style: {
              color: "var(--ghost-gray)",
              fontSize: 11,
              whiteSpace: "nowrap"
            },
            children: [X.length, " \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23"]
          })]
        }), e.jsx("div", {
          style: {
            display: "flex",
            gap: 8,
            marginBottom: 16,
            flexWrap: "wrap"
          },
          children: xe.map(t => e.jsx("div", {
            onClick: () => y(t),
            className: "btn",
            style: {
              fontSize: 11,
              textTransform: "uppercase",
              borderColor: b === t ? "var(--blood)" : "var(--line)",
              color: b === t ? "var(--bone)" : "var(--ghost-gray)",
              background: b === t ? "rgba(196,30,42,0.14)" : "rgba(255,255,255,0.02)"
            },
            children: t === "all" ? "ALL" : t
          }, t))
        }), e.jsxs("div", {
          className: "pos-service-grid",
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 10
          },
          children: [X.map(t => e.jsxs("div", {
            onClick: () => me(t),
            role: "button",
            tabIndex: t.pricingError || f ? -1 : 0,
            "aria-disabled": !!t.pricingError || f,
            onKeyDown: event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); me(t); } },
            className: "panel",
            style: {
              cursor: t.pricingError ? "not-allowed" : "pointer",
              opacity: t.pricingError ? 0.55 : 1,
              overflow: "hidden"
            },
            children: [v && chillMenuImage(t) && e.jsx("div", {
              style: {
                alignItems: "center",
                background: "radial-gradient(circle at 50% 60%,rgba(196,30,42,.14),transparent 68%),#090a0c",
                display: "flex",
                height: 170,
                justifyContent: "center",
                margin: "-16px -16px 12px",
                overflow: "hidden"
              },
              children: e.jsx("img", {
                key: chillMenuImage(t),
                src: chillMenuImage(t),
                alt: t.name,
                loading: "lazy",
                onError: r => {
                  const image = r.currentTarget;
                  image.style.opacity = "0";
                },
                onLoad: r => { r.currentTarget.style.opacity = "1"; },
                style: { height: "100%", objectFit: "contain", width: "100%" }
              })
            }), e.jsx("div", {
              style: {
                fontSize: 9,
                color: "var(--ghost-gray)",
                textTransform: "uppercase",
                marginBottom: 4
              },
              children: t.category
            }), e.jsx("div", {
              style: {
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 6
              },
              children: t.name
            }), e.jsxs("div", {
              className: "font-mono",
              style: {
                fontSize: 13,
                color: "var(--blood)",
                fontWeight: 600
              },
              children: priceLabel(t)
            })]
          }, t.id)), g.length === 0 && e.jsx("div", {
            style: {
              gridColumn: "1/-1",
              color: "var(--ghost-gray)",
              fontSize: 12
            },
            children: '\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23\u0E43\u0E19\u0E2A\u0E32\u0E02\u0E32\u0E19\u0E35\u0E49 \u2014 \u0E40\u0E1E\u0E34\u0E48\u0E21\u0E44\u0E14\u0E49\u0E17\u0E35\u0E48\u0E41\u0E17\u0E47\u0E1A "Services"'
          }), g.length > 0 && X.length === 0 && e.jsx("div", {
            style: {
              color: "var(--ghost-gray)",
              fontSize: 12,
              gridColumn: "1/-1",
              padding: "20px 0",
              textAlign: "center"
            },
            children: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23\u0E17\u0E35\u0E48\u0E04\u0E49\u0E19\u0E2B\u0E32"
          })]
        })]
      }), e.jsxs("div", {
        className: "panel pos-cart",
        style: {
          position: "sticky",
          top: 16
        },
        children: [e.jsxs("div", {
          className: "font-display",
          style: {
            fontSize: 13,
            letterSpacing: 1,
            color: "var(--blood)",
            marginBottom: 14
          },
          children: ["\u25B8 NEW BILL \u2014 ", a, n.key === "garage" ? ` · ${vehicleLabels[vehicleClass]}` : ""]
        }), v ? e.jsxs(e.Fragment, {
          children: [e.jsxs("div", {
            style: {
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 8
            },
            children: [e.jsx("button", {
              type: "button",
              className: `btn ${q === "dine_in" ? "btn-primary" : "btn-secondary"}`,
              onClick: () => se("dine_in"),
              children: "\u{1F37D} \u0E17\u0E32\u0E19\u0E17\u0E35\u0E48\u0E23\u0E49\u0E32\u0E19"
            }), e.jsx("button", {
              type: "button",
              className: `btn ${q === "takeaway" ? "btn-primary" : "btn-secondary"}`,
              onClick: () => se("takeaway"),
              children: "\u{1F961} \u0E01\u0E25\u0E31\u0E1A\u0E1A\u0E49\u0E32\u0E19"
            })]
          }), q === "dine_in" && e.jsx("input", {
            className: "input",
            placeholder: "\u0E40\u0E25\u0E02\u0E42\u0E15\u0E4A\u0E30 \u0E40\u0E0A\u0E48\u0E19 A3",
            value: H,
            onChange: t => ie(t.target.value),
            style: {
              marginBottom: 8
            }
          })]
        }) : e.jsxs(e.Fragment, {
          children: [e.jsx("input", {
            className: "input",
            placeholder: "\u0E17\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E19 / Plate",
            value: l,
            onChange: t => o(t.target.value),
            style: {
              marginBottom: 8
            }
          }), e.jsx("input", {
            className: "input",
            placeholder: "\u0E23\u0E16 / \u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14",
            value: s,
            onChange: t => r(t.target.value),
            style: {
              marginBottom: 8
            }
          })]
        }), e.jsx("input", {
          className: "input",
          placeholder: "\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38 (optional)",
          value: c,
          onChange: t => S(t.target.value),
          style: {
            marginBottom: 14
          }
        }), e.jsxs("div", {
          style: {
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginBottom: 14
          },
          children: [e.jsx("button", {
            type: "button",
            className: `btn ${$ === "cash" ? "btn-primary" : "btn-secondary"}`,
            onClick: () => re("cash"),
            children: "\u{1F4B4} \u0E40\u0E07\u0E34\u0E19\u0E2A\u0E14"
          }), e.jsx("button", {
            type: "button",
            className: `btn ${$ === "transfer" ? "btn-primary" : "btn-secondary"}`,
            onClick: () => re("transfer"),
            children: "\u2197 \u0E40\u0E07\u0E34\u0E19\u0E42\u0E2D\u0E19"
          })]
        }), $ === "cash" && e.jsxs("div", {
          style: {
            marginBottom: 12
          },
          children: [e.jsx("input", {
            className: "input",
            type: "number",
            min: O,
            placeholder: "\u0E23\u0E31\u0E1A\u0E40\u0E07\u0E34\u0E19\u0E2A\u0E14 (\u0E44\u0E21\u0E48\u0E1A\u0E31\u0E07\u0E04\u0E31\u0E1A)",
            value: I,
            onChange: t => oe(t.target.value)
          }), I !== "" && e.jsxs("div", {
            style: {
              color: "#84d6a8",
              fontSize: 12,
              marginTop: 5
            },
            children: ["\u0E40\u0E07\u0E34\u0E19\u0E17\u0E2D\u0E19 \xA5", Math.max(0, Number(I) - O).toLocaleString()]
          })]
        }), e.jsx("div", {
          style: {
            minHeight: 60,
            borderBottom: "1px dashed var(--line)",
            paddingBottom: 10,
            marginBottom: 10
          },
          children: u.length === 0 ? e.jsx("div", {
            style: {
              color: "var(--ghost-gray)",
              fontSize: 11,
              textAlign: "center",
              padding: "16px 0"
            },
            children: "// \u0E04\u0E25\u0E34\u0E01\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E1E\u0E34\u0E48\u0E21"
          }) : ve.map(t => e.jsxs("div", {
            style: {
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              gap: 10,
              padding: "7px 0"
            },
            children: [e.jsxs("div", {
              style: {
                minWidth: 0
              },
              children: [e.jsx("div", {
                style: {
                  fontWeight: 600
                },
                children: t.name
              }), e.jsxs("div", {
                style: {
                  color: "var(--ghost-gray)",
                  fontSize: 10
                },
                children: [priceLabel(t), t.pricingError ? "" : " / ชิ้น"]
              })]
            }), e.jsxs("div", {
              style: {
                alignItems: "center",
                display: "flex",
                gap: 7,
                whiteSpace: "nowrap"
              },
              children: [e.jsx("button", {
                type: "button",
                onClick: () => be(t.id),
                "aria-label": `\u0E25\u0E14\u0E08\u0E33\u0E19\u0E27\u0E19 ${t.name}`,
                style: {
                  background: "transparent",
                  border: "1px solid var(--line)",
                  borderRadius: 4,
                  color: "var(--bone)",
                  cursor: "pointer",
                  height: 22,
                  width: 22
                },
                children: "\u2212"
              }), e.jsxs("span", {
                className: "font-mono",
                style: {
                  minWidth: 21,
                  textAlign: "center"
                },
                children: ["\xD7", t.quantity]
              }), e.jsx("button", {
                type: "button",
                onClick: () => me(t),
                "aria-label": `\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E08\u0E33\u0E19\u0E27\u0E19 ${t.name}`,
                style: {
                  background: "transparent",
                  border: "1px solid var(--line)",
                  borderRadius: 4,
                  color: "var(--bone)",
                  cursor: "pointer",
                  height: 22,
                  width: 22
                },
                children: "+"
              }), e.jsxs("strong", {
                className: "font-mono",
                style: {
                  minWidth: 60,
                  textAlign: "right"
                },
                children: t.pricingError ? "—" : ["\xA5", t.lineTotal.toLocaleString()]
              }), e.jsx("span", {
                onClick: () => m(d => d.filter(_ => _.id !== t.id)),
                style: {
                  color: "var(--ghost-gray)",
                  cursor: "pointer",
                  fontSize: 14
                },
                children: "\u2715"
              })]
            })]
          }, t.id))
        }), e.jsxs("div", {
          onClick: je,
          className: "panel",
          style: {
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            marginBottom: E ? 8 : 12,
            cursor: "pointer"
          },
          children: [e.jsx("div", {
            style: {
              width: 34,
              height: 18,
              borderRadius: 10,
              background: E ? "var(--blood)" : "rgba(255,255,255,0.15)",
              position: "relative",
              flexShrink: 0,
              transition: "background .15s"
            },
            children: e.jsx("div", {
              style: {
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "var(--bone)",
                position: "absolute",
                top: 2,
                left: E ? 18 : 2,
                transition: "left .15s"
              }
            })
          }), e.jsxs("div", {
            children: [e.jsx("div", {
              style: {
                fontSize: 12,
                fontWeight: 600
              },
              children: "\u2605 \u0E21\u0E35 MEMBER"
            }), e.jsx("div", {
              style: {
                fontSize: 10,
                color: "var(--ghost-gray)"
              },
              children: "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E2A\u0E30\u0E2A\u0E21\u0E40\u0E1B\u0E49\u0E32\u0E2B\u0E21\u0E32\u0E22 MT \u0E41\u0E25\u0E30\u0E04\u0E39\u0E1B\u0E2D\u0E07"
            })]
          })]
        }), E && e.jsxs("div", {
          style: {
            marginBottom: 12
          },
          onClick: t => t.stopPropagation(),
          children: [e.jsxs("div", {
            style: {
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6
            },
            children: [e.jsx("span", {
              style: {
                color: "var(--ghost-gray)",
                fontSize: 10,
                letterSpacing: 0.8
              },
              children: "MEMBERS & COUPONS"
            }), e.jsx(Ce, {
              to: "/members",
              style: {
                color: "var(--bone)",
                fontSize: 10,
                textDecoration: "underline"
              },
              children: "\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D Members \u2197"
            })]
          }), C ? e.jsxs("div", {
            className: "panel",
            style: {
              padding: "10px 12px"
            },
            children: [e.jsxs("div", {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              },
              children: [e.jsxs("div", {
                children: [e.jsx("div", {
                  style: {
                    fontSize: 13,
                    fontWeight: 600
                  },
                  children: C.name
                }), e.jsxs("div", {
                  style: {
                    fontSize: 11,
                    color: "var(--ghost-gray)"
                  },
                  children: [N.plan.label, " \xB7", " ", N.active ? `\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38 ${we(C.membership_expires_at)}` : "\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38 \u2014 \u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E2A\u0E48\u0E27\u0E19\u0E25\u0E14"]
                })]
              }), e.jsx("div", {
                onClick: () => P(null),
                style: {
                  color: "var(--ghost-gray)",
                  cursor: "pointer",
                  fontSize: 14
                },
                children: "\u2715"
              })]
            }), e.jsxs("div", {
              children: [N.active && e.jsx("div", {
                style: {
                  color: "#e5c158",
                  fontSize: 11,
                  fontWeight: 600,
                  marginTop: 10
                },
                children: "\u2726 MEMBER: Engine Repair Kit \u0E41\u0E25\u0E30 Full Repair Kit \u0E1F\u0E23\u0E35"
              }), U.length > 0 && e.jsxs("label", {
                style: {
                  alignItems: "center",
                  color: "#e5c158",
                  cursor: "pointer",
                  display: "flex",
                  fontSize: 11,
                  gap: 7,
                  marginTop: 10
                },
                children: [e.jsx("input", {
                  type: "checkbox",
                  checked: ce,
                  onChange: t => J(t.target.checked)
                }), " ", "\u0E43\u0E0A\u0E49\u0E04\u0E39\u0E1B\u0E2D\u0E07\u0E0B\u0E48\u0E2D\u0E21\u0E1F\u0E23\u0E35 1 \u0E04\u0E23\u0E31\u0E49\u0E07 (", U.length, " \u0E43\u0E1A)"]
              })]
            })]
          }) : e.jsxs("div", {
            style: {
              position: "relative"
            },
            children: [e.jsx("input", {
              className: "input",
              autoFocus: true,
              placeholder: "\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E17\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E19\u0E23\u0E16 \u0E2B\u0E23\u0E37\u0E2D\u0E0A\u0E37\u0E48\u0E2D Member...",
              value: T,
              onChange: t => G(t.target.value)
            }), (ae.length > 0 || T.trim()) && e.jsxs("div", {
              className: "panel",
              style: {
                position: "absolute",
                top: "110%",
                left: 0,
                right: 0,
                zIndex: 10,
                padding: 8
              },
              children: [ae.map(t => e.jsxs("div", {
                onClick: () => ge(t),
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 6px",
                  cursor: "pointer",
                  borderRadius: 6
                },
                children: [e.jsxs("div", {
                  children: [e.jsx("span", {
                    style: {
                      fontSize: 13,
                      fontWeight: 500
                    },
                    children: t.name
                  }), e.jsx("span", {
                    style: {
                      fontSize: 11,
                      color: "var(--ghost-gray)",
                      marginLeft: 8
                    },
                    children: t.plate_or_note
                  })]
                }), e.jsx("div", {
                  style: {
                    fontSize: 11,
                    color: "var(--ghost-gray)"
                  },
                  children: he(t, W, n.key).active ? "ACTIVE" : "\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38"
                })]
              }, t.id)), e.jsx("div", {
                onClick: () => Q(true),
                style: {
                  padding: "8px 6px",
                  color: "var(--blood)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer"
                },
                children: "+ \u0E40\u0E1E\u0E34\u0E48\u0E21 Member \u0E43\u0E2B\u0E21\u0E48"
              })]
            })]
          })]
        }), e.jsxs("div", {
          onClick: () => te(t => !t),
          className: "panel",
          style: {
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            marginBottom: 12,
            cursor: "pointer"
          },
          children: [e.jsx("div", {
            style: {
              width: 34,
              height: 18,
              borderRadius: 10,
              background: M ? "var(--blood)" : "rgba(255,255,255,0.15)",
              position: "relative",
              flexShrink: 0,
              transition: "background .15s"
            },
            children: e.jsx("div", {
              style: {
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "var(--bone)",
                position: "absolute",
                top: 2,
                left: M ? 18 : 2,
                transition: "left .15s"
              }
            })
          }), e.jsxs("div", {
            children: [e.jsx("div", {
              style: {
                fontSize: 12,
                fontWeight: 600
              },
              children: "\u270F SELF SERVICE"
            }), e.jsx("div", {
              style: {
                fontSize: 10,
                color: "var(--ghost-gray)"
              },
              children: "TOTAL & COMMISSION = 0 \xA5"
            })]
          })]
        }), e.jsxs("div", {
          className: "font-mono",
          style: {
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            color: "var(--ghost-gray)",
            marginBottom: 6
          },
          children: [e.jsx("span", {
            children: "COMMISSION (FLAT)"
          }), e.jsxs("span", {
            children: ["\xA5", pe.toLocaleString()]
          })]
        }), E && C && !M && e.jsxs(e.Fragment, {
          children: [e.jsxs("div", {
            className: "font-mono",
            style: {
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              color: "var(--ghost-gray)",
              marginBottom: 6
            },
            children: [e.jsx("span", {
              children: "SUBTOTAL"
            }), e.jsxs("span", {
              children: ["\xA5", W.toLocaleString()]
            })]
          }), e.jsxs("div", {
            className: "font-mono",
            style: {
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              color: N.percentage ? "#84d6a8" : "var(--ghost-gray)",
              marginBottom: 6
            },
            children: [e.jsxs("span", {
              children: ["MEMBER DISCOUNT", " ", N.percentage ? `(${N.percentage}%)` : ""]
            }), e.jsxs("span", {
              children: ["\u2212\xA5", N.amount.toLocaleString()]
            })]
          }), Y && e.jsxs("div", {
            className: "font-mono",
            style: {
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              color: "#e5c158",
              marginBottom: 6
            },
            children: [e.jsx("span", {
              children: "MEMBER FREE REPAIR KITS"
            }), e.jsxs("span", {
              children: ["\u2212\xA5", F.toLocaleString()]
            })]
          }), de && e.jsxs("div", {
            className: "font-mono",
            style: {
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              color: "#e5c158",
              marginBottom: 6
            },
            children: [e.jsx("span", {
              children: "FREE REPAIR COUPON"
            }), e.jsxs("span", {
              children: ["\u2212\xA5", N.total.toLocaleString()]
            })]
          })]
        }), e.jsxs("div", {
          className: "font-mono",
          style: {
            display: "flex",
            justifyContent: "space-between",
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 14
          },
          children: [e.jsx("span", {
            children: "TOTAL"
          }), e.jsxs("span", {
            style: {
              color: "var(--blood)"
            },
            children: pricingBlocked ? "ยังคำนวณไม่ได้" : ["\xA5", O.toLocaleString()]
          })]
        }), pricingBlocked && e.jsx("p", {
          role: "alert",
          style: { color: "#e5c158", fontSize: 12 },
          children: "มีรายการที่ยังไม่มีราคาสำหรับรถประเภทนี้ กรุณานำรายการนั้นออกหรือกลับไปเลือก Standard ก่อนบันทึก"
        }), e.jsx("button", {
          type: "button",
          onClick: Se,
          disabled: f || u.length === 0 || pricingBlocked,
          className: "btn btn-primary",
          style: {
            width: "100%",
            justifyContent: "center",
            opacity: f || u.length === 0 || pricingBlocked ? 0.5 : 1
          },
          children: f ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01..." : "\u25B8 SUBMIT BILL"
        })]
      })]
    }), R && e.jsx("div", {
      style: {
        position: "fixed",
        bottom: 24,
        right: 24,
        background: "var(--static)",
        border: "1px solid var(--blood)",
        padding: "12px 18px",
        borderRadius: 6,
        fontSize: 12
      },
      children: R
    }), fe && e.jsx(Te, {
      branch: n,
      initialQuery: T,
      onClose: () => Q(false),
      onCreated: t => {
        ge(t), Q(false);
      }
    })]
  });
}
function Te({
  branch: n,
  initialQuery: a,
  onClose: p,
  onCreated: v
}) {
  const [g, h] = i.useState(a || ""),
    [b, y] = i.useState(""),
    [j, k] = i.useState(""),
    [u, m] = i.useState(""),
    [l, o] = i.useState(false),
    s = ke("regular", n.key);
  async function r() {
    if (!g.trim()) return;
    o(true);
    const c = (/* @__PURE__ */new Date()).toISOString(),
      S = Ne(),
      {
        data: f,
        error: w
      } = await x.from("members").insert({
        branch_id: n.id,
        name: g.trim(),
        phone: b || null,
        plate_or_note: j || u || null,
        tier: "regular",
        membership_started_at: c,
        membership_expires_at: S,
        membership_fee: s.monthlyFee
      }).select().single();
    if (o(false), w) {
      console.error(w);
      return;
    }
    await x.from("member_memberships").insert({
      member_id: f.id,
      tier: s.key,
      monthly_fee: s.monthlyFee,
      months: 1,
      total_paid: s.monthlyFee,
      started_at: c,
      expires_at: S
    }), v(f);
  }
  return e.jsx("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 100
    },
    children: e.jsxs("div", {
      className: "panel",
      style: {
        width: "100%",
        maxWidth: 420,
        background: "var(--static)"
      },
      children: [e.jsxs("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16
        },
        children: [e.jsx("div", {
          className: "font-display",
          style: {
            fontSize: 16,
            fontWeight: 600
          },
          children: "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E43\u0E2B\u0E21\u0E48"
        }), e.jsx("div", {
          onClick: p,
          style: {
            cursor: "pointer",
            color: "var(--ghost-gray)",
            fontSize: 18
          },
          children: "\u2715"
        })]
      }), e.jsxs("div", {
        style: {
          marginBottom: 10
        },
        children: [e.jsx("label", {
          style: {
            fontSize: 11,
            color: "var(--ghost-gray)",
            display: "block",
            marginBottom: 6
          },
          children: "\u0E0A\u0E37\u0E48\u0E2D"
        }), e.jsx("input", {
          className: "input",
          value: g,
          onChange: c => h(c.target.value)
        })]
      }), e.jsxs("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 10
        },
        children: [e.jsxs("div", {
          children: [e.jsx("label", {
            style: {
              fontSize: 11,
              color: "var(--ghost-gray)",
              display: "block",
              marginBottom: 6
            },
            children: "\u0E40\u0E1A\u0E2D\u0E23\u0E4C"
          }), e.jsx("input", {
            className: "input",
            value: b,
            onChange: c => y(c.target.value)
          })]
        }), e.jsxs("div", {
          children: [e.jsx("label", {
            style: {
              fontSize: 11,
              color: "var(--ghost-gray)",
              display: "block",
              marginBottom: 6
            },
            children: "\u0E17\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E19"
          }), e.jsx("input", {
            className: "input",
            value: j,
            onChange: c => k(c.target.value)
          })]
        })]
      }), e.jsxs("div", {
        style: {
          marginBottom: 18
        },
        children: [e.jsx("label", {
          style: {
            fontSize: 11,
            color: "var(--ghost-gray)",
            display: "block",
            marginBottom: 6
          },
          children: "\u0E42\u0E19\u0E49\u0E15"
        }), e.jsx("input", {
          className: "input",
          value: u,
          onChange: c => m(c.target.value)
        })]
      }), e.jsxs("div", {
        style: {
          display: "flex",
          gap: 10,
          justifyContent: "flex-end"
        },
        children: [e.jsx("div", {
          onClick: p,
          className: "btn btn-secondary",
          children: "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01"
        }), e.jsx("div", {
          onClick: r,
          className: "btn btn-primary",
          style: {
            opacity: l ? 0.6 : 1
          },
          children: l ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E1E\u0E34\u0E48\u0E21..." : `\u0E2A\u0E21\u0E31\u0E04\u0E23 ${s.label} ${s.monthlyFee ? `\xA5${s.monthlyFee.toLocaleString()}` : "\u0E1F\u0E23\u0E35"}`
        })]
      })]
    })
  });
}
function Ee({
  branch: n,
  staff: a,
  onBillDeleted: p
}) {
  const [v, g] = i.useState([]),
    [h, b] = i.useState(true),
    [y, j] = i.useState(""),
    [k, u] = i.useState(null);
  async function m(l) {
    const o = "ยกเลิกโดยผู้ดูแลระบบ";
    const {
      error: s
    } = await x.rpc("cancel_bill_safely", {
      p_bill_id: l.id,
      p_reason: o.trim()
    });
    if (s) {
      console.error(s), alert(ye(s, "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E1A\u0E34\u0E25\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2B\u0E23\u0E37\u0E2D\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23"));
      return;
    }
    g(r => r.map(c => c.id === l.id ? {
      ...c,
      status: "rejected",
      total: 0,
      commission: 0,
      cancellation_reason: o.trim()
    } : c)), u(null);
  }
  return i.useEffect(() => {
    let l = true;
    async function o() {
      b(true), j("");
      const {
        data: s,
        error: r
      } = await x.from("bills").select("*, staff:staff_id(name_en)").eq("branch_id", n.id).order("created_at", {
        ascending: false
      }).limit(100);
      r && console.error(r);
      const c = s || [],
        S = c.map(w => w.id);
      let f = {};
      if (S.length) {
        const {
          data: w,
          error: z
        } = await x.from("bill_items").select("bill_id, name_snapshot, price_snapshot").in("bill_id", S);
        z ? (console.error(z), l && j(z.message)) : f = (w || []).reduce((R, A) => (R[A.bill_id] = [...(R[A.bill_id] || []), A], R), {});
      }
      l && (g(c.map(w => ({
        ...w,
        items: f[w.id] || []
      }))), b(false));
    }
    return o(), () => {
      l = false;
    };
  }, [n]), e.jsxs("div", {
    className: "panel",
    children: [e.jsx("div", {
      className: "font-display",
      style: {
        fontSize: 14,
        fontWeight: 600,
        marginBottom: 14
      },
      children: "\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E1A\u0E34\u0E25 \xB7 Bills"
    }), y && e.jsxs("div", {
      style: {
        background: "rgba(196,30,42,.1)",
        border: "1px solid rgba(196,30,42,.35)",
        color: "#ff9ea5",
        fontSize: 11,
        marginBottom: 12,
        padding: "9px 10px"
      },
      children: ["\u0E14\u0E36\u0E07\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E19\u0E1A\u0E34\u0E25\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08: ", y]
    }), h ? e.jsx("div", {
      style: {
        color: "var(--ghost-gray)",
        fontSize: 12
      },
      children: "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E42\u0E2B\u0E25\u0E14..."
    }) : v.length === 0 ? e.jsx("div", {
      style: {
        color: "var(--ghost-gray)",
        fontSize: 12,
        textAlign: "center",
        padding: "24px 0"
      },
      children: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1A\u0E34\u0E25"
    }) : v.map(l => {
      var o;
      return e.jsx(Ie, {
        bill: l,
        expanded: k === l.id,
        onToggle: () => u(s => s === l.id ? null : l.id),
        canDelete: ["god", "owner", "chill_manager"].includes(a == null ? void 0 : a.role) || l.staff_id === (a == null ? void 0 : a.id) && ((o = a == null ? void 0 : a.permissions) == null ? void 0 : o.includes("bill_delete_own")),
        onDelete: () => m(l)
      }, l.id);
    })]
  });
}
function Ie({
  bill: n,
  expanded: a,
  onToggle: p,
  canDelete: v,
  onDelete: g
}) {
  var u;
  const h = ze(n.notes),
    b = (n.items || []).length ? n.items : h.items,
    y = Object.values(b.reduce((m, l) => {
      const o = m[l.name_snapshot] || {
        name: l.name_snapshot,
        quantity: 0,
        total: 0
      };
      return m[l.name_snapshot] = {
        ...o,
        quantity: o.quantity + 1,
        total: o.total + Number(l.price_snapshot || 0)
      }, m;
    }, {})),
    j = Math.max(0, Number(n.subtotal || 0) - Number(n.total || 0));
  function k(m) {
    m.stopPropagation();
    const l = (h.vehicleClass ? `<caption>${vehicleLabels[h.vehicleClass]}</caption>` : "") + y.map(s => `<tr><td>${s.name} \xD7${s.quantity}</td><td>\xA5${s.total.toLocaleString()}</td></tr>`).join(""),
      o = window.open("", "_blank", "width=420,height=700");
    o == null || o.document.write(`<html><head><title>${n.bill_number}</title><style>body{font-family:Arial,sans-serif;width:72mm;margin:8mm auto;color:#111}h2,p{text-align:center;margin:4px}table{width:100%;border-collapse:collapse;margin:14px 0}td{padding:5px 0;border-bottom:1px dashed #aaa}td:last-child{text-align:right}.total{font-size:20px;font-weight:bold;text-align:right}@media print{button{display:none}}</style></head><body><h2>${n.order_type ? "SABINAGISA" : "GHOST LAB"}</h2><p>${n.bill_number}</p><p>${new Date(n.created_at).toLocaleString("th-TH")}</p><table>${l}</table><div class="total">TOTAL \xA5${Number(n.total || 0).toLocaleString()}</div><p>${n.payment_method === "transfer" ? "\u0E40\u0E07\u0E34\u0E19\u0E42\u0E2D\u0E19" : "\u0E40\u0E07\u0E34\u0E19\u0E2A\u0E14"}${n.change_due ? ` \xB7 \u0E40\u0E07\u0E34\u0E19\u0E17\u0E2D\u0E19 \xA5${Number(n.change_due).toLocaleString()}` : ""}</p><button onclick="print()">\u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E43\u0E1A\u0E40\u0E2A\u0E23\u0E47\u0E08</button></body></html>`), o == null || o.document.close();
  }
  return e.jsxs("div", {
    style: {
      borderBottom: "1px solid var(--line)",
      fontSize: 12
    },
    children: [e.jsxs("div", {
      onClick: p,
      style: {
        alignItems: "center",
        cursor: "pointer",
        display: "flex",
        justifyContent: "space-between",
        padding: "11px 0"
      },
      children: [e.jsxs("div", {
        children: [e.jsxs("span", {
          className: "font-mono",
          style: {
            fontWeight: 600
          },
          children: [a ? "\u2304" : "\u203A", " ", n.bill_number, h.vehicleClass ? ` · ${vehicleLabels[h.vehicleClass]}` : ""]
        }), e.jsxs("span", {
          style: {
            color: "var(--ghost-gray)",
            marginLeft: 10
          },
          children: [n.order_type === "takeaway" ? "\u0E01\u0E25\u0E31\u0E1A\u0E1A\u0E49\u0E32\u0E19" : n.table_number ? `\u0E42\u0E15\u0E4A\u0E30 ${n.table_number}` : n.plate || "\u2014", " ", n.vehicle ? `\xB7 ${n.vehicle}` : ""]
        }), e.jsxs("div", {
          style: {
            color: "var(--ghost-gray)",
            fontSize: 11,
            marginTop: 2
          },
          children: [((u = n.staff) == null ? void 0 : u.name_en) || "\u2014", " \xB7", " ", n.payment_method === "transfer" ? "\u0E40\u0E07\u0E34\u0E19\u0E42\u0E2D\u0E19" : "\u0E40\u0E07\u0E34\u0E19\u0E2A\u0E14", " \xB7", " ", new Date(n.created_at).toLocaleString("th-TH"), " \xB7 \u0E04\u0E25\u0E34\u0E01\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E14\u0E39\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23"]
        })]
      }), e.jsxs("div", {
        style: {
          alignItems: "center",
          display: "flex",
          gap: 10
        },
        children: [e.jsxs("div", {
          className: "font-mono",
          style: {
            fontWeight: 600
          },
          children: ["\xA5", Number(n.total || 0).toLocaleString()]
        }), e.jsx("button", {
          type: "button",
          onClick: k,
          className: "btn",
          style: {
            fontSize: 11,
            padding: "4px 7px"
          },
          children: "\u0E43\u0E1A\u0E40\u0E2A\u0E23\u0E47\u0E08"
        }), v && n.status !== "rejected" && e.jsx("button", {
          type: "button",
          onClick: m => {
            m.stopPropagation(), g();
          },
          title: "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E1A\u0E34\u0E25\u0E02\u0E2D\u0E07\u0E09\u0E31\u0E19",
          style: {
            background: "transparent",
            border: "1px solid rgba(196,30,42,.55)",
            borderRadius: 5,
            color: "#f18b92",
            cursor: "pointer",
            fontSize: 11,
            padding: "4px 7px"
          },
          children: "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E1A\u0E34\u0E25"
        })]
      })]
    }), a && e.jsxs("div", {
      style: {
        background: "rgba(255,255,255,.025)",
        borderTop: "1px solid var(--line)",
        margin: "0 -8px",
        padding: "12px 14px"
      },
      children: [e.jsx("div", {
        style: {
          color: "var(--ghost-gray)",
          fontSize: 10,
          letterSpacing: 0.8,
          marginBottom: 7
        },
        children: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E17\u0E35\u0E48\u0E17\u0E33"
      }), y.length === 0 ? e.jsx("div", {
        style: {
          color: "var(--ghost-gray)",
          fontSize: 11
        },
        children: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E19\u0E1A\u0E34\u0E25\u0E19\u0E35\u0E49"
      }) : y.map(m => e.jsxs("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          padding: "4px 0"
        },
        children: [e.jsxs("span", {
          children: [m.name, " ", e.jsxs("span", {
            style: {
              color: "var(--ghost-gray)"
            },
            children: ["\xD7", m.quantity]
          })]
        }), e.jsxs("span", {
          className: "font-mono",
          children: ["\xA5", m.total.toLocaleString()]
        })]
      }, m.name)), e.jsxs("div", {
        style: {
          borderTop: "1px dashed var(--line)",
          display: "grid",
          gap: 4,
          gridTemplateColumns: "1fr auto",
          marginTop: 9,
          paddingTop: 9
        },
        children: [e.jsx("span", {
          style: {
            color: "var(--ghost-gray)"
          },
          children: "Subtotal"
        }), e.jsxs("span", {
          className: "font-mono",
          children: ["\xA5", Number(n.subtotal || 0).toLocaleString()]
        }), j > 0 && e.jsxs(e.Fragment, {
          children: [e.jsxs("span", {
            style: {
              color: "#84d6a8"
            },
            children: ["\u0E2A\u0E48\u0E27\u0E19\u0E25\u0E14 ", n.discount_pct ? `(${n.discount_pct}%)` : ""]
          }), e.jsxs("span", {
            className: "font-mono",
            style: {
              color: "#84d6a8"
            },
            children: ["\u2212\xA5", j.toLocaleString()]
          })]
        }), e.jsx("span", {
          style: {
            color: "var(--ghost-gray)"
          },
          children: "Commission"
        }), e.jsxs("span", {
          className: "font-mono",
          style: {
            color: "#e5c158"
          },
          children: ["\xA5", Number(n.commission || 0).toLocaleString()]
        }), e.jsx("strong", {
          children: "TOTAL"
        }), e.jsxs("strong", {
          className: "font-mono",
          style: {
            color: "var(--blood)"
          },
          children: ["\xA5", Number(n.total || 0).toLocaleString()]
        })]
      }), h.note && e.jsxs("div", {
        style: {
          color: "var(--ghost-gray)",
          fontSize: 11,
          marginTop: 10
        },
        children: ["\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38: ", h.note]
      })]
    })]
  });
}
function Re({
  branch: n
}) {
  const [a, p] = i.useState([]),
    [v, g] = i.useState(true),
    [h, b] = i.useState(null),
    [y, j] = i.useState({});
  i.useEffect(() => {
    k();
  }, [n]);
  async function k() {
    g(true);
    const {
      data: s,
      error: r
    } = await x.from("services").select("*").eq("branch_id", n.id).eq("active", true).order("category");
    const visibleServices = (s || []).filter(service => visibleService(service, n.key));
    if (r && console.error(r), p(visibleServices), g(false), visibleServices.length) {
      const {
          data: c
        } = await x.from("service_materials").select("service_id").in("service_id", visibleServices.map(f => f.id)),
        S = {};
      (c || []).forEach(f => {
        S[f.service_id] = (S[f.service_id] || 0) + 1;
      }), j(S);
    }
  }
  async function u() {
    const {
      data: s,
      error: r
    } = await x.from("services").insert({
      branch_id: n.id,
      category: "\u0E17\u0E31\u0E48\u0E27\u0E44\u0E1B",
      name: "\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23\u0E43\u0E2B\u0E21\u0E48",
      price: 0,
      active: true
    }).select().single();
    if (r) {
      console.error(r);
      return;
    }
    p(c => [...c, s]);
  }
  async function createSABINAGISAMenu() {
    if (n.key !== "chill") return;
    const { data: existing, error: loadError } = await x.from("services").select("id,name").eq("branch_id", n.id).eq("active", true);
    if (loadError) return console.error(loadError);
    const existingNames = new Set((existing || []).map(service => normalizeServiceName(service.name)));
    await x.from("services").update({ active: false }).eq("branch_id", n.id).in("name", ["Iced Matcha", "Ramen Ghost Special"]);
    const missing = sabinagisaMenu.filter(item => !existingNames.has(normalizeServiceName(item.name)));
    if (!missing.length) return;
    const { data: created, error } = await x.from("services").insert(missing.map(item => ({ branch_id: n.id, name: item.name, category: item.category, price: 0, active: true }))).select();
    if (error) return console.error(error);
    p(items => [...items.filter(item => visibleService(item, n.key)), ...(created || [])]);
  }
  async function m(s, r, c) {
    p(S => S.map(f => f.id === s ? {
      ...f,
      [r]: c
    } : f));
  }
  async function l(s, r, c) {
    const S = r === "price" ? {
        price: parseInt(c) || 0
      } : {
        [r]: c
      },
      {
        error: f
      } = await x.from("services").update(S).eq("id", s);
    f && console.error(f);
  }
  async function uploadServiceImage(service, file) {
    if (!file || n.key !== "chill") return;
    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("รูปต้องมีขนาดไม่เกิน 5 MB");
      return;
    }
    const extension = (file.name.split(".").pop() || "png").replace(/[^a-z0-9]/gi, "").toLowerCase();
    const storagePath = `${n.key}/${service.id}-${Date.now()}.${extension}`;
    const { error: uploadError } = await x.storage.from("service-images").upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false
    });
    if (uploadError) {
      console.error(uploadError);
      alert(`อัปโหลดรูปไม่สำเร็จ: ${uploadError.message}`);
      return;
    }
    const { data: publicData } = x.storage.from("service-images").getPublicUrl(storagePath);
    const imageUrl = publicData?.publicUrl || "";
    const { error: saveError } = await x.from("services").update({ image_url: imageUrl }).eq("id", service.id);
    if (saveError) {
      console.error(saveError);
      alert(`บันทึกรูปไม่สำเร็จ: ${saveError.message}`);
      return;
    }
    m(service.id, "image_url", imageUrl);
  }
  async function o(s) {
    if (!confirm("\u0E25\u0E1A\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23\u0E19\u0E35\u0E49?")) return;
    const {
      error: r
    } = await x.from("services").delete().eq("id", s);
    if (r) {
      console.error(r);
      return;
    }
    p(c => c.filter(S => S.id !== s));
  }
  const serviceGridColumns = n.key === "chill" ? "64px 2fr 1.3fr 1fr 1fr 1fr auto" : "2fr 1.3fr 1fr 1fr 1fr auto";
  return e.jsxs("div", {
    className: "panel",
    children: [e.jsxs("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16
      },
      children: [e.jsxs("div", {
        children: [e.jsx("div", {
          className: "font-display",
          style: {
            fontSize: 16,
            fontWeight: 600,
            color: "var(--blood)"
          },
          children: "SERVICES CATALOG"
        }), e.jsxs("div", {
          style: {
            fontSize: 12,
            color: "var(--ghost-gray)"
          },
          children: [a.length, " services available", n.key === "garage" ? " · รายการที่ตรงแค็ตตาล็อกใช้ราคาจากไฟล์ (งานบำรุงรักษาใช้ราคาอู่) · รายการอื่นใช้ราคาเดิมสำหรับ Standard" : ""]
        })]
      }), e.jsx("div", {
        onClick: u,
        className: "btn btn-primary",
        children: n.key === "chill" ? "+ เพิ่มเมนู SABINAGISA" : "+ ADD SERVICE"
      })]
    }), v ? e.jsx("div", {
      style: {
        color: "var(--ghost-gray)",
        fontSize: 12
      },
      children: "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E42\u0E2B\u0E25\u0E14..."
    }) : e.jsxs("div", {
      children: [e.jsxs("div", {
        style: {
          display: "grid",
          gridTemplateColumns: serviceGridColumns,
          gap: 10,
          padding: "0 0 10px",
          fontSize: 10,
          color: "var(--ghost-gray)",
          textTransform: "uppercase",
          letterSpacing: 1
        },
        children: [n.key === "chill" && e.jsx("div", {
          children: "Image"
        }), e.jsx("div", {
          children: "Name"
        }), e.jsx("div", {
          children: "Category"
        }), e.jsx("div", {
          children: n.key === "garage" ? "Standard / Super Car (¥)" : "Price (¥)"
        }), e.jsx("div", {
          children: "Materials"
        }), e.jsx("div", {
          children: "MT Loyalty"
        }), e.jsx("div", {})]
      }), a.map(s => e.jsxs("div", {
        style: {
          borderBottom: "1px solid var(--line)"
        },
        children: [e.jsxs("div", {
          style: {
            display: "grid",
            gridTemplateColumns: serviceGridColumns,
          gap: 6,
          padding: "3px 0",
            alignItems: "center"
          },
          children: [n.key === "chill" && e.jsx("div", {
            style: { alignItems: "center", background: "#090a0c", border: "1px solid var(--line)", borderRadius: 6, display: "flex", height: 36, justifyContent: "center", overflow: "hidden" },
            children: chillMenuImage(s) ? e.jsx("img", {
              key: chillMenuImage(s),
              src: chillMenuImage(s),
              alt: "",
              loading: "lazy",
              onError: r => {
                const image = r.currentTarget;
                image.style.opacity = "0";
              },
              onLoad: r => { r.currentTarget.style.opacity = "1"; },
              style: { height: "100%", objectFit: "contain", width: "100%" }
            }) : e.jsx("span", { style: { color: "var(--ghost-gray)", fontSize: 9 }, children: "NO IMAGE" })
          }), e.jsxs("div", { style: { display: "grid", gap: 4 }, children: [e.jsx("input", {
            className: "input",
            value: s.name,
          onChange: r => m(s.id, "name", r.target.value),
            onBlur: r => l(s.id, "name", r.target.value)
          }), n.key === "chill" && e.jsxs("label", {
            className: "btn btn-secondary",
            style: { cursor: "pointer", fontSize: 10, justifyContent: "center", padding: "6px 8px" },
            children: ["↑ อัปโหลดรูปจากเครื่อง", e.jsx("input", {
              type: "file",
              accept: "image/png,image/jpeg,image/webp,image/gif",
              style: { display: "none" },
              onChange: r => uploadServiceImage(s, r.target.files?.[0])
            })]
          })] }), e.jsx("input", {
            className: "input",
            value: s.category,
            onChange: r => m(s.id, "category", r.target.value),
            onBlur: r => l(s.id, "category", r.target.value)
          }), e.jsxs("div", {
            children: [e.jsx("input", {
              className: "input font-mono",
              "aria-label": `ราคา Standard ${s.name}`,
              readOnly: n.key === "garage" && catalogEntry(s)?.status === "priced",
              title: n.key === "garage" && catalogEntry(s)?.status === "priced" ? "ราคาจาก catalog_lite.html" : "ราคาเดิมของบริการ",
              value: n.key === "garage" && catalogEntry(s)?.status === "priced" ? priceService(s).price : s.price,
              style: { color: "var(--blood)", fontWeight: 600 },
              onChange: r => m(s.id, "price", r.target.value),
              onBlur: r => { if (!(n.key === "garage" && catalogEntry(s)?.status === "priced")) l(s.id, "price", r.target.value); }
            }), n.key === "garage" && e.jsx("div", {
              style: { fontSize: 12, marginTop: 4, color: "var(--ghost-gray)" },
              children: `Super Car: ${priceLabel(priceService(s, "supercar"))}`
            })]
          }), e.jsx("div", {
            onClick: () => b(h === s.id ? null : s.id),
            style: {
              fontSize: 12,
              cursor: "pointer",
              color: y[s.id] ? "var(--blood)" : "var(--ghost-gray)"
            },
            children: y[s.id] ? `${y[s.id]} items` : "\u2699 \u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32"
          }), e.jsxs("label", {
            style: {
              alignItems: "center",
              color: s.loyalty_eligible ? "var(--bone)" : "var(--ghost-gray)",
              cursor: "pointer",
              display: "flex",
              fontSize: 11,
              gap: 6
            },
            children: [e.jsx("input", {
              type: "checkbox",
              checked: !!s.loyalty_eligible,
              onChange: r => {
                m(s.id, "loyalty_eligible", r.target.checked), l(s.id, "loyalty_eligible", r.target.checked);
              }
            }), "\u0E19\u0E31\u0E1A\u0E0B\u0E48\u0E2D\u0E21"]
          }), e.jsx("div", {
            onClick: () => o(s.id),
            className: "btn",
            style: {
              color: "var(--blood)",
              borderColor: "rgba(196,30,42,0.4)",
              padding: "10px 14px"
            },
            children: "\u{1F5D1}"
          })]
        }), h === s.id && e.jsx(Ae, {
          branch: n,
          service: s,
          onSaved: r => {
            j(c => ({
              ...c,
              [s.id]: r
            })), b(null);
          }
        })]
      }, s.id)), a.length === 0 && e.jsx("div", {
        style: {
          color: "var(--ghost-gray)",
          fontSize: 12,
          textAlign: "center",
          padding: "24px 0"
        },
        children: '\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23 \u2014 \u0E01\u0E14 "+ ADD SERVICE" \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E23\u0E34\u0E48\u0E21\u0E40\u0E1E\u0E34\u0E48\u0E21'
      })]
    })]
  });
}
function Ae({
  branch: n,
  service: a,
  onSaved: p
}) {
  const [v, g] = i.useState([]),
    [h, b] = i.useState({}),
    [y, j] = i.useState(true),
    [k, u] = i.useState(false);
  i.useEffect(() => {
    async function o() {
      const [{
        data: s,
        error: r
      }, {
        data: c,
        error: S
      }] = await Promise.all([x.from("stock_items").select("*").eq("branch_id", n.id).order("name"), x.from("service_materials").select("stock_item_id, qty_per_unit").eq("service_id", a.id)]);
      r && console.error(r), S && console.error(S), g(s || []);
      const f = {};
      (c || []).forEach(w => {
        f[w.stock_item_id] = w.qty_per_unit;
      }), b(f), j(false);
    }
    o();
  }, [n, a]);
  function m(o, s) {
    const r = parseInt(s) || 0;
    b(c => ({
      ...c,
      [o]: r
    }));
  }
  async function l() {
    u(true), await x.from("service_materials").delete().eq("service_id", a.id);
    const o = Object.entries(h).filter(([, s]) => s > 0).map(([s, r]) => ({
      service_id: a.id,
      stock_item_id: s,
      qty_per_unit: r
    }));
    if (o.length) {
      const {
        error: s
      } = await x.from("service_materials").insert(o);
      s && console.error(s);
    }
    u(false), p(o.length);
  }
  return e.jsxs("div", {
    style: {
      background: "rgba(255,255,255,0.02)",
      borderRadius: 8,
      padding: 16,
      margin: "4px 0 14px"
    },
    children: [e.jsx("div", {
      style: {
        fontSize: 11,
        color: "var(--ghost-gray)",
        marginBottom: 12
      },
      children: "MATERIALS / PARTS USED \u2014 \u0E43\u0E2A\u0E48\u0E08\u0E33\u0E19\u0E27\u0E19\u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E15\u0E48\u0E2D 1 \u0E07\u0E32\u0E19 \xB7 \u0E08\u0E30\u0E2B\u0E31\u0E01\u0E08\u0E32\u0E01 Stock \u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E23\u0E31\u0E1A\u0E07\u0E32\u0E19"
    }), y ? e.jsx("div", {
      style: {
        color: "var(--ghost-gray)",
        fontSize: 12
      },
      children: "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E42\u0E2B\u0E25\u0E14..."
    }) : v.length === 0 ? e.jsx("div", {
      style: {
        color: "var(--ghost-gray)",
        fontSize: 12
      },
      children: '\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A\u0E43\u0E19\u0E2A\u0E32\u0E02\u0E32\u0E19\u0E35\u0E49 \u2014 \u0E44\u0E1B\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E17\u0E35\u0E48\u0E2B\u0E19\u0E49\u0E32 "\u0E2A\u0E15\u0E4A\u0E2D\u0E01 & \u0E40\u0E1A\u0E34\u0E01\u0E08\u0E48\u0E32\u0E22" \u0E01\u0E48\u0E2D\u0E19'
    }) : e.jsxs(e.Fragment, {
      children: [e.jsx("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 14
        },
        children: v.map(o => e.jsxs("div", {
          children: [e.jsx("div", {
            style: {
              fontSize: 11,
              fontWeight: 600,
              marginBottom: 6,
              textTransform: "uppercase"
            },
            children: o.name
          }), e.jsx("input", {
            className: "input",
            type: "number",
            min: "0",
            value: h[o.id] || 0,
            onChange: s => m(o.id, s.target.value),
            style: {
              fontSize: 12
            }
          }), e.jsxs("div", {
            style: {
              fontSize: 10,
              color: "var(--ghost-gray)",
              marginTop: 4
            },
            children: ["\u0E40\u0E2B\u0E25\u0E37\u0E2D ", o.quantity, " ", o.unit || "\u0E0A\u0E34\u0E49\u0E19"]
          })]
        }, o.id))
      }), e.jsx("div", {
        onClick: l,
        className: "btn btn-primary",
        style: {
          opacity: k ? 0.6 : 1
        },
        children: k ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01..." : "\u{1F4BE} \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01 Materials"
      })]
    })]
  });
}
export { $e as P };
