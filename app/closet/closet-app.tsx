"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  categories,
  occasions,
  matchOutfit,
  missingPieces,
  validClothing,
  type Clothing,
  type Outfit,
  type Preferences,
} from "@/lib/closet";
import { readCloset, writeCloset } from "@/lib/closet-storage";
import { track } from "@/lib/analytics";
import styles from "./closet.module.css";

const blank = (): Clothing => ({
  id: crypto.randomUUID(),
  name: "",
  category: "Top",
  color: "",
  pattern: "Solid",
  style: "Casual",
  formality: 1,
  warmth: 2,
  image: "",
});
function Photo({ item }: { item: Clothing }) {
  return item.image ? (
    <Image
      src={item.image}
      alt={item.name || "Your clothing photo"}
      width={450}
      height={450}
      unoptimized
    />
  ) : (
    <span className={styles.noPhoto}>
      No photo added
      <small>{item.category}</small>
    </span>
  );
}
async function photoData(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG or WebP photo.");
  if (file.size > 12000000)
    throw new Error("Choose a photo smaller than 12 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 900 / Math.max(image.width, image.height));
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not read this photo.");
    context.fillStyle = "#f7f5ee";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = 0.85;
    let data = canvas.toDataURL("image/jpeg", quality);
    while (data.length > 600000 && quality > 0.25) {
      quality -= 0.15;
      data = canvas.toDataURL("image/jpeg", quality);
    }
    if (data.length > 650000)
      throw new Error("This photo is still too large. Try a smaller image.");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function api(input: unknown) {
  const response = await fetch("/api/closet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}
export default function ClosetApp({
  standalone = false,
}: {
  standalone?: boolean;
}) {
  const [items, setItems] = useState<Clothing[]>([]);
  const [saved, setSaved] = useState<Outfit[]>([]);
  const [tutorialDone, setTutorialDone] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const tutorial = useRef<HTMLDialogElement>(null);
  const appRoot = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [ai, setAi] = useState(false);
  const [tab, setTab] = useState<"closet" | "outfit" | "saved">("closet");
  const [filter, setFilter] = useState("All");
  const [draft, setDraft] = useState<Clothing | null>(null);
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [preferences, setPreferences] = useState<Preferences>({
    occasion: "University",
    weather: "Mild",
    mood: "Balanced",
    notes: "",
  });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editorError, setEditorError] = useState("");
  const [storageError, setStorageError] = useState("");
  const upload = useRef<HTMLInputElement>(null);
  const editor = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true;
    readCloset()
      .then((state) => {
        if (active && state) {
          setItems(
            Array.isArray(state.items)
              ? state.items
                  .filter(validClothing)
                  .filter((i) => !i.sample)
                  .slice(0, 24)
              : [],
          );
          setSaved(
            Array.isArray(state.saved)
              ? state.saved
                  .filter(
                    (look) =>
                      !look.itemIds?.some((id) => id.startsWith("sample-")) &&
                      !look.pieces?.some(
                        (piece) =>
                          piece.sample || piece.image.startsWith("/pieces/"),
                      ),
                  )
                  .slice(0, 8)
              : [],
          );
          setTutorialDone(state.tutorialDone === true);
        }
      })
      .catch(() => {
        if (active)
          setStorageError(
            "Your browser could not open saved storage. This session still works, but it may not be kept after you leave.",
          );
      })
      .finally(() => {
        if (active) {
          try {
            if (localStorage.getItem("wera-tour-v1") === "done")
              setTutorialDone(true);
          } catch {}
          setReady(true);
        }
      });
    fetch("/api/closet")
      .then((r) => r.json())
      .then((r) => {
        if (active) {
          setAi(r.aiAvailable === true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      writeCloset({ items, saved, tutorialDone }).catch(() =>
        setStorageError(
          "Storage is full or unavailable. Keep this page open, and download any outfit images you want to keep.",
        ),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [items, saved, ready, tutorialDone]);
  useEffect(() => {
    if (draft && !editor.current?.open) editor.current?.showModal();
    if (!draft && editor.current?.open) editor.current.close();
  }, [draft]);
  useEffect(() => {
    if (!ready || tutorialDone) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setTutorialOpen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    if (appRoot.current) observer.observe(appRoot.current);
    return () => observer.disconnect();
  }, [ready, tutorialDone]);
  useEffect(() => {
    if (tutorialOpen && !tutorial.current?.open) tutorial.current?.showModal();
    if (!tutorialOpen && tutorial.current?.open) tutorial.current.close();
  }, [tutorialOpen]);
  function finishTutorial() {
    try {
      localStorage.setItem("wera-tour-v1", "done");
    } catch {}
    setTutorialDone(true);
    setTutorialOpen(false);
  }
  const tutorialSteps = [
    {
      title: "Start with what’s already yours.",
      text: "Upload a clear photo of each piece. WERA identifies it automatically; review the details and save. Start with a top, bottom and shoes — or a one-piece and shoes.",
      label: "01 / YOUR REAL CLOSET",
    },
    {
      title: "Dress for your kind of day.",
      text: "Pick your occasion, weather and mood. WERA picks from your own pieces and creates an outfit image.",
      label: "02 / ONE LESS DECISION",
    },
    {
      title: "Keep a look you love.",
      text: "Save your outfit for another day. With photos on every selected piece, an AI flat-lay preview is created automatically. Details may differ; your original photos stay alongside it. Everything is saved in this browser.",
      label: "03 / MAKE IT YOURS",
    },
  ];
  function event(name: string, params: Record<string, string> = {}) {
    track(name, {
      source: standalone ? "closet_app" : "landing_app",
      ...params,
    });
  }
  function openDraft(item?: Clothing) {
    setEditorError("");
    setMessage("");
    setDraft(item ? { ...item } : blank());
  }
  async function uploadPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const previous = draft;
    setBusy("photo");
    setError("");
    setEditorError("");
    try {
      const image = await photoData(file);
      const current = { ...(previous || blank()), image, sample: undefined };
      setDraft(current);
      setBusy("analyze");
      try {
        const result = await api({ action: "analyze", image });
        setDraft({ ...current, ...result.details });
      } catch (error) {
        setEditorError(
          error instanceof Error
            ? error.message
            : "Photo analysis did not finish. Retry analysis below.",
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "This photo could not be read.";
      if (previous) setEditorError(message);
      else setError(message);
    } finally {
      setBusy("");
    }
  }
  async function analyze() {
    if (!draft?.image) return;
    const current = draft;
    setBusy("analyze");
    setEditorError("");
    try {
      const result = await api({ action: "analyze", image: current.image });
      setDraft({ ...current, ...result.details });
    } catch (error) {
      setEditorError(
        error instanceof Error
          ? error.message
          : "Enter the clothing details manually.",
      );
    } finally {
      setBusy("");
    }
  }
  function add(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const clean = {
      ...draft,
      name: draft.name.trim(),
      color: draft.color.trim(),
      style: draft.style.trim(),
    };
    if (!validClothing(clean) || !clean.color || !clean.style) {
      setEditorError("Give this piece a name, color and style.");
      return;
    }
    if (items.length >= 24 && !items.some((i) => i.id === draft.id)) {
      setEditorError(
        "Your closet holds 24 pieces. Remove one before adding another.",
      );
      return;
    }
    const exists = items.some((i) => i.id === clean.id);
    setItems((current) =>
      exists
        ? current.map((i) => (i.id === clean.id ? clean : i))
        : [...current, clean],
    );
    setOutfit(null);
    setDraft(null);
    setMessage(
      exists ? "Piece updated." : "A new possibility, added to your closet.",
    );
    if (!exists) event("clothing_item_added");
  }
  async function generate(local = false) {
    setError("");
    setMessage("");
    setBusy("outfit");
    try {
      let next: Outfit;
      if (ai && !local) {
        const response = await api({
          action: "outfit",
          items: items.map((i) => ({ ...i, image: "" })),
          preferences,
          previous: outfit?.itemIds || [],
        });
        next = response.outfit;
      } else next = matchOutfit(items, preferences, outfit?.itemIds || []);
      const pieces = items
        .filter((i) => next.itemIds.includes(i.id))
        .map((i) => ({ ...i }));
      const look = { ...next, pieces };
      setOutfit(look);
      setTab("outfit");
      event("outfit_generated", { occasion: preferences.occasion });
      if (pieces.some((piece) => !piece.image)) {
        setError(
          "Add a photo to every selected piece so WERA can create your outfit image.",
        );
        return;
      }
      setBusy("image");
      const response = await api({
        action: "image",
        items: pieces,
        itemIds: look.itemIds,
        preferences,
      });
      setOutfit({ ...look, image: response.image });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Your outfit could not be generated.",
      );
    } finally {
      setBusy("");
    }
  }
  async function generateImage() {
    if (!outfit) return;
    setBusy("image");
    setError("");
    setMessage("");
    try {
      const selected =
        outfit.pieces || items.filter((i) => outfit.itemIds.includes(i.id));
      const response = await api({
        action: "image",
        items: selected,
        itemIds: outfit.itemIds,
        preferences: { ...preferences, occasion: outfit.occasion },
      });
      const next = { ...outfit, image: response.image };
      setOutfit(next);
      setSaved((current) => current.map((o) => (o.id === next.id ? next : o)));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The image could not be generated.",
      );
    } finally {
      setBusy("");
    }
  }
  function save() {
    if (!outfit) return;
    if (saved.some((o) => o.id === outfit.id)) {
      setMessage("This outfit is already saved.");
      return;
    }
    if (saved.length >= 8) {
      setError("You have eight saved outfits. Remove one to make room.");
      return;
    }
    setSaved((current) => [outfit, ...current]);
    setMessage("Saved on this device.");
  }
  const missing = missingPieces(items);
  const visible = items.filter(
    (i) => filter === "All" || i.category === filter,
  );
  const selected =
    outfit?.pieces || items.filter((i) => outfit?.itemIds.includes(i.id));
  const formality = ["Casual", "Smart casual", "Formal"];
  const Heading = standalone ? "h1" : "h2";
  return (
    <div ref={appRoot} className={styles.app} aria-busy={Boolean(busy)}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>YOUR PIECES. NEW POSSIBILITIES.</p>
          <Heading>
            {standalone ? "WERA / YOUR CLOSET" : "A good day starts here."}
          </Heading>
          <p>Add what you own. We’ll help you put it together.</p>
        </div>
        {standalone && (
          <a href="/#try-wera" className={styles.quiet}>
            ← About WERA
          </a>
        )}
      </header>
      <div className={styles.tabs} role="tablist" aria-label="Your closet app">
        {(
          [
            ["closet", "Your closet", items.length],
            ["outfit", "Today’s outfit", ""],
            ["saved", "Saved looks", saved.length],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            role="tab"
            id={`wera-tab-${value}`}
            aria-controls={`wera-panel-${value}`}
            aria-selected={tab === value}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => setTab(value)}
            onKeyDown={(event) => {
              const tabs = ["closet", "outfit", "saved"] as const;
              const index = tabs.indexOf(value);
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % 3
                  : event.key === "ArrowLeft"
                    ? (index + 2) % 3
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 2
                        : -1;
              if (next < 0) return;
              event.preventDefault();
              setTab(tabs[next]);
              document.getElementById(`wera-tab-${tabs[next]}`)?.focus();
            }}
            className={tab === value ? styles.activeTab : ""}
          >
            {label}
            {count !== "" && <span>{count}</span>}
          </button>
        ))}
      </div>
      {!ready ? (
        <p className={styles.notice} role="status">
          Opening your closet…
        </p>
      ) : (
        <div className={styles.workspace}>
          <section
            className={styles.main}
            role="tabpanel"
            id={`wera-panel-${tab}`}
            aria-labelledby={`wera-tab-${tab}`}
          >
            {tab === "closet" && (
              <>
                <div className={styles.toolbar}>
                  <div>
                    <h3>Already yours.</h3>
                    <p>
                      {items.length
                        ? `${items.length} pieces · ${24 - items.length} spaces left`
                        : "A little closet is all you need."}
                    </p>
                  </div>
                  <button
                    className={styles.primary}
                    disabled={Boolean(busy) || items.length >= 24}
                    onClick={() => openDraft()}
                  >
                    ＋ Add a piece
                  </button>
                </div>
                {items.length > 0 && (
                  <div className={styles.filters} aria-label="Filter clothing">
                    {["All", ...categories].map((category) => (
                      <button
                        key={category}
                        aria-pressed={filter === category}
                        onClick={() => setFilter(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                )}
                {!items.length ? (
                  <div className={styles.empty}>
                    <span className={styles.emptyMark}>W</span>
                    <h3>Your closet has the answer.</h3>
                    <p>
                      Start with a top, a bottom and shoes — or a one-piece and
                      shoes. Upload photos to identify your pieces automatically
                      and create outfit images.
                    </p>
                    <button
                      className={styles.primary}
                      disabled={Boolean(busy)}
                      onClick={() => upload.current?.click()}
                    >
                      {busy === "photo"
                        ? "Preparing photo…"
                        : "Upload your first piece"}
                    </button>
                    <button
                      className={styles.quiet}
                      onClick={() => openDraft()}
                    >
                      Add without a photo
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={styles.grid}>
                      {visible.map((item) => (
                        <button
                          className={styles.piece}
                          key={item.id}
                          onClick={() => openDraft(item)}
                        >
                          <div className={styles.piecePhoto}>
                            <Photo item={item} />
                          </div>
                          <h4>{item.name}</h4>
                          <p>
                            {item.category} · {item.color}
                          </p>
                          <span>
                            {formality[item.formality - 1]} <i>↗ Edit</i>
                          </span>
                        </button>
                      ))}
                    </div>
                    {!visible.length && (
                      <p className={styles.notice}>
                        No {filter.toLowerCase()} in your closet yet.
                      </p>
                    )}
                    <p className={styles.hint}>
                      Select a piece to edit its details or remove it.
                    </p>
                  </>
                )}
              </>
            )}
            {tab === "outfit" &&
              (!outfit ? (
                <div className={styles.empty}>
                  <span className={styles.emptyMark}>↗</span>
                  <h3>One less decision.</h3>
                  <p>
                    Choose the occasion and create an outfit using the pieces in
                    your closet.
                  </p>
                  <button
                    className={styles.primary}
                    disabled={Boolean(busy) || Boolean(missing.length)}
                    onClick={() => generate()}
                  >
                    {busy === "image"
                      ? "Creating your image…"
                      : busy === "outfit"
                        ? "Finding your outfit…"
                        : "Create my outfit"}
                  </button>
                  {Boolean(missing.length) && (
                    <p>Add {missing.join(" and ")} first.</p>
                  )}
                </div>
              ) : (
                <div className={styles.result}>
                  <div className={styles.resultHeading}>
                    <p className={styles.eyebrow}>
                      {outfit.occasion.toUpperCase()} /{" "}
                      {outfit.source === "Gemini"
                        ? "AI STYLED"
                        : "CLOSET MATCHING"}
                    </p>
                    <h3>{outfit.title}</h3>
                  </div>
                  {busy === "image" && (
                    <div className={styles.imageProgress} role="status">
                      <span
                        className={styles.imageSpinner}
                        aria-hidden="true"
                      />
                      <h4>Creating your outfit image…</h4>
                      <p>Arranging your own pieces into a flat-lay preview.</p>
                    </div>
                  )}
                  {outfit.image ? (
                    <>
                      <Image
                        className={styles.generated}
                        src={outfit.image}
                        alt={`AI flat-lay illustration of ${outfit.title}`}
                        width={1024}
                        height={1024}
                        unoptimized
                      />
                      <p className={styles.hint}>
                        AI visualization — small details may differ. Your
                        original pieces are shown below.
                      </p>
                    </>
                  ) : null}
                  <p className={styles.eyebrow}>YOUR ORIGINAL PIECES</p>
                  <div className={styles.outfitBoard}>
                    {selected.map((item) => (
                      <div key={item.id}>
                        <Photo item={item} />
                        <span>{item.name}</span>
                      </div>
                    ))}
                  </div>
                  <details className={styles.explanation}>
                    <summary>Why this outfit works</summary>
                    <p className={styles.eyebrow}>WHY IT WORKS</p>
                    <p>{outfit.reason}</p>
                    <p className={styles.tip}>{outfit.tips}</p>
                  </details>
                  <div className={styles.resultActions}>
                    <button
                      className={styles.primary}
                      onClick={save}
                      disabled={Boolean(busy)}
                    >
                      {saved.some((o) => o.id === outfit.id)
                        ? "✓ Saved"
                        : "Save this look"}
                    </button>
                    <button
                      className={styles.secondary}
                      onClick={() => generate()}
                      disabled={Boolean(busy) || Boolean(missing.length)}
                    >
                      Try another combination
                    </button>
                    {
                      <button
                        className={styles.secondary}
                        onClick={generateImage}
                        disabled={
                          Boolean(busy) || selected.some((item) => !item.image)
                        }
                      >
                        {busy === "image"
                          ? "Creating image…"
                          : outfit.image
                            ? "Recreate outfit image"
                            : "Create an outfit image ✧"}
                      </button>
                    }
                    {outfit.image && (
                      <a
                        className={styles.quiet}
                        href={outfit.image}
                        download={`wera-outfit.${outfit.image.startsWith("data:image/jpeg") ? "jpg" : outfit.image.startsWith("data:image/webp") ? "webp" : "png"}`}
                      >
                        Download image ↓
                      </a>
                    )}
                  </div>
                  {
                    <p className={styles.hint}>
                      {selected.some((item) => !item.image)
                        ? "Add a photo to every selected piece to create an image."
                        : "Creating an AI preview sends the selected photos to Cloudflare. Details may differ; compare with your originals."}
                    </p>
                  }
                </div>
              ))}
            {tab === "saved" && (
              <>
                <div className={styles.toolbar}>
                  <div>
                    <h3>A few good looks.</h3>
                    <p>
                      Saved on this browser and device. Up to eight outfits.
                    </p>
                  </div>
                </div>
                {!saved.length ? (
                  <div className={styles.empty}>
                    <span className={styles.emptyMark}>♡</span>
                    <h3>Keep the ones you love.</h3>
                    <p>Create an outfit, then save it here for another day.</p>
                    <button
                      className={styles.secondary}
                      onClick={() => setTab("closet")}
                    >
                      Back to your closet
                    </button>
                  </div>
                ) : (
                  <div className={styles.savedGrid}>
                    {saved.map((look) => (
                      <article className={styles.savedCard} key={look.id}>
                        <button
                          className={styles.savedOpen}
                          onClick={() => {
                            setOutfit(look);
                            setTab("outfit");
                            setPreferences((p) => ({
                              ...p,
                              occasion: look.occasion,
                            }));
                            setMessage("");
                            setError("");
                          }}
                        >
                          <div className={styles.savedPreview}>
                            {look.image ? (
                              <Image
                                src={look.image}
                                alt={look.title}
                                width={500}
                                height={500}
                                unoptimized
                              />
                            ) : (
                              (look.pieces || [])
                                .slice(0, 3)
                                .map((item) => (
                                  <Photo key={item.id} item={item} />
                                ))
                            )}
                          </div>
                          <p className={styles.eyebrow}>{look.occasion}</p>
                          <h4>{look.title}</h4>
                          <span>Open look ↗</span>
                        </button>
                        <button
                          className={styles.removeSaved}
                          aria-label={`Remove saved look ${look.title}`}
                          onClick={() =>
                            setSaved((current) =>
                              current.filter((o) => o.id !== look.id),
                            )
                          }
                        >
                          Remove
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
          <aside className={styles.planner}>
            <span className={styles.stepNumber}>02 / THE DAY AHEAD</span>
            <h3>
              What’s on
              <br />
              the agenda?
            </h3>
            <p>
              Same closet. <br />
              Different kind of day.
            </p>
            <fieldset>
              <legend>Choose your occasion</legend>
              <div className={styles.occasions}>
                {occasions.map((occasion) => (
                  <button
                    key={occasion}
                    aria-pressed={preferences.occasion === occasion}
                    onClick={() => {
                      setPreferences((p) => ({ ...p, occasion }));
                      event("occasion_selected", { occasion });
                    }}
                  >
                    <span>
                      {occasion === "Presentation / Interview"
                        ? "Presentation / Interview"
                        : occasion}
                    </span>
                    <span>{preferences.occasion === occasion ? "●" : "○"}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <label className={styles.field}>
              Weather
              <select
                value={preferences.weather}
                onChange={(e) =>
                  setPreferences((p) => ({
                    ...p,
                    weather: e.target.value as Preferences["weather"],
                  }))
                }
              >
                <option>Warm</option>
                <option>Mild</option>
                <option>Cold</option>
              </select>
            </label>
            <label className={styles.field}>
              How do you want to feel?
              <select
                value={preferences.mood}
                onChange={(e) =>
                  setPreferences((p) => ({
                    ...p,
                    mood: e.target.value as Preferences["mood"],
                  }))
                }
              >
                <option>Comfortable</option>
                <option>Balanced</option>
                <option>Polished</option>
              </select>
            </label>
            {ai && (
              <label className={styles.field}>
                Anything else? <span>AI styling only</span>
                <textarea
                  maxLength={300}
                  rows={2}
                  value={preferences.notes}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, notes: e.target.value }))
                  }
                  placeholder="A long walk between classes, no layers…"
                />
              </label>
            )}
            <button
              className={styles.primary}
              disabled={Boolean(busy) || Boolean(missing.length)}
              onClick={() => generate()}
            >
              {busy === "image"
                ? "Creating your image…"
                : busy === "outfit"
                  ? "Finding your outfit…"
                  : "Create my outfit →"}
            </button>
            {Boolean(missing.length) && (
              <p className={styles.requirement}>
                Add {missing.join(" and ")} to get started.
              </p>
            )}
            {ai && (
              <button
                className={styles.quiet}
                disabled={Boolean(busy) || Boolean(missing.length)}
                onClick={() => generate(true)}
              >
                Use closet matching instead
              </button>
            )}
            <p className={styles.hint}>
              {ai
                ? "Uploading a photo sends it to Google for automatic identification. Creating an outfit sends the selected photos to Cloudflare for its image."
                : "Closet matching uses your pieces’ color, pattern, style, formality and warmth. AI features become available when the site owner connects Google."}
            </p>
          </aside>
        </div>
      )}
      <div className={styles.messages} aria-live="polite">
        {message && <p role="status">{message}</p>}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {storageError && (
          <p className={styles.error} role="status">
            {storageError}
          </p>
        )}
      </div>
      <footer className={styles.footer}>
        <span>YOUR CLOSET. REIMAGINED.</span>
        <span>No account. Your closet stays in this browser.</span>
        <button
          className={styles.quiet}
          onClick={() => {
            setTutorialStep(0);
            setTutorialOpen(true);
          }}
        >
          Quick tour ↗
        </button>
        {!standalone && (
          <a href="/closet" target="_blank" rel="noopener noreferrer">
            Open the app ↗
          </a>
        )}
      </footer>
      <dialog
        ref={tutorial}
        className={styles.tutorial}
        aria-labelledby="wera-tutorial-title"
        aria-describedby="wera-tutorial-description"
        onCancel={finishTutorial}
        onClose={() => {
          if (tutorialOpen) finishTutorial();
        }}
      >
        <div className={styles.tutorialTop}>
          <span>WERA / A LITTLE INTRODUCTION</span>
          <button className={styles.quiet} onClick={finishTutorial}>
            Skip intro
          </button>
        </div>
        <div className={styles.tutorialArt} aria-hidden="true">
          <span>{String(tutorialStep + 1).padStart(2, "0")}</span>
          <i>
            YOUR PIECES.
            <br />
            NEW POSSIBILITIES.
          </i>
        </div>
        <p className={styles.eyebrow}>{tutorialSteps[tutorialStep].label}</p>
        <h2 id="wera-tutorial-title">{tutorialSteps[tutorialStep].title}</h2>
        <p id="wera-tutorial-description">{tutorialSteps[tutorialStep].text}</p>
        <div className={styles.tutorialBottom}>
          <span aria-label={`Step ${tutorialStep + 1} of 3`}>
            {tutorialSteps.map((_, index) => (
              <i
                key={index}
                className={index === tutorialStep ? styles.currentDot : ""}
              />
            ))}
          </span>
          <div>
            {tutorialStep > 0 && (
              <button
                className={styles.quiet}
                onClick={() => setTutorialStep((step) => step - 1)}
              >
                Back
              </button>
            )}
            <button
              className={styles.primary}
              onClick={() => {
                if (tutorialStep < 2) setTutorialStep((step) => step + 1);
                else {
                  finishTutorial();
                  setTab("closet");
                }
              }}
            >
              {tutorialStep < 2 ? "Next →" : "Open my closet →"}
            </button>
          </div>
        </div>
      </dialog>
      <input
        ref={upload}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className={styles.hidden}
        aria-label="Upload clothing photo"
        onChange={uploadPhoto}
      />
      <dialog
        ref={editor}
        aria-labelledby="wera-editor-title"
        className={styles.dialog}
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setDraft(null);
        }}
        onClose={() => {
          if (!busy) setDraft(null);
        }}
      >
        {draft && (
          <form onSubmit={add}>
            <div className={styles.dialogHeading}>
              <div>
                <p className={styles.eyebrow}>01 / YOUR PIECES</p>
                <h3 id="wera-editor-title">
                  {items.some((i) => i.id === draft.id)
                    ? "A closer look."
                    : "Add a little possibility."}
                </h3>
              </div>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => setDraft(null)}
                aria-label="Close clothing editor"
              >
                ×
              </button>
            </div>
            <div className={styles.editorLayout}>
              <div>
                <div className={styles.editorPhoto}>
                  <Photo item={draft} />
                </div>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={Boolean(busy)}
                  onClick={() => upload.current?.click()}
                >
                  {draft.image ? "Choose another photo" : "Add a photo"}
                </button>
                {draft.image.startsWith("data:") && (
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={Boolean(busy)}
                    onClick={analyze}
                  >
                    {busy === "analyze"
                      ? "Looking at your piece…"
                      : "Re-analyze photo ✧"}
                  </button>
                )}
                <p className={styles.hint}>
                  {busy === "analyze"
                    ? "Analyzing your photo and filling in the details…"
                    : draft.image
                      ? "Your photo is analyzed automatically. Review the filled-in details and save. Photo analysis sends this image to Google."
                      : "Upload a clothing photo to fill in these details automatically. You can also enter them manually."}
                </p>
              </div>
              <fieldset
                aria-label="Clothing details"
                disabled={Boolean(busy)}
                className={styles.editorFields}
              >
                <label className={styles.field}>
                  Piece name
                  <input
                    required
                    maxLength={100}
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                    placeholder="White cotton shirt"
                  />
                </label>
                <label className={styles.field}>
                  Type
                  <select
                    value={draft.category}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        category: e.target.value as Clothing["category"],
                      })
                    }
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <div className={styles.twoFields}>
                  <label className={styles.field}>
                    Color
                    <input
                      required
                      maxLength={80}
                      value={draft.color}
                      onChange={(e) =>
                        setDraft({ ...draft, color: e.target.value })
                      }
                      placeholder="White, navy, sage…"
                    />
                  </label>
                  <label className={styles.field}>
                    Pattern
                    <select
                      value={draft.pattern}
                      onChange={(e) =>
                        setDraft({ ...draft, pattern: e.target.value })
                      }
                    >
                      {[
                        "Solid",
                        "Striped",
                        "Checked",
                        "Floral",
                        "Graphic",
                        "Other",
                        ...(![
                          "Solid",
                          "Striped",
                          "Checked",
                          "Floral",
                          "Graphic",
                          "Other",
                        ].includes(draft.pattern)
                          ? [draft.pattern]
                          : []),
                      ].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className={styles.field}>
                  Style
                  <input
                    required
                    maxLength={80}
                    value={draft.style}
                    onChange={(e) =>
                      setDraft({ ...draft, style: e.target.value })
                    }
                    placeholder="Classic, relaxed, sporty…"
                  />
                </label>
                <div className={styles.twoFields}>
                  <label className={styles.field}>
                    Formality
                    <select
                      value={draft.formality}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          formality: Number(e.target.value),
                        })
                      }
                    >
                      {formality.map((f, i) => (
                        <option key={f} value={i + 1}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    Warmth
                    <select
                      value={draft.warmth}
                      onChange={(e) =>
                        setDraft({ ...draft, warmth: Number(e.target.value) })
                      }
                    >
                      {["Light", "Medium", "Warm"].map((w, i) => (
                        <option key={w} value={i + 1}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>
            </div>
            {editorError && (
              <p className={styles.error} role="alert">
                {editorError}
              </p>
            )}
            <div className={styles.dialogActions}>
              {items.some((i) => i.id === draft.id) && (
                <button
                  type="button"
                  className={styles.delete}
                  disabled={Boolean(busy)}
                  onClick={() => {
                    setItems((current) =>
                      current.filter((i) => i.id !== draft.id),
                    );
                    setOutfit(null);
                    setDraft(null);
                    setMessage(
                      "Piece removed. Your saved looks are still here.",
                    );
                  }}
                >
                  Remove piece
                </button>
              )}
              <button
                className={styles.primary}
                type="submit"
                disabled={Boolean(busy)}
              >
                Save piece →
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
