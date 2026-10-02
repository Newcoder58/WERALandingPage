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
  sampleCloset,
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
      {item.category === "Shoes"
        ? "↗"
        : item.category === "Accessory"
          ? "◯"
          : "◇"}
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
  const [ready, setReady] = useState(false);
  const [ai, setAi] = useState(false);
  const [imageAi, setImageAi] = useState(false);
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
              ? state.items.filter(validClothing).slice(0, 24)
              : [],
          );
          setSaved(Array.isArray(state.saved) ? state.saved.slice(0, 8) : []);
        }
      })
      .catch(() => {
        if (active)
          setStorageError(
            "Your browser could not open saved storage. This session still works, but it may not be kept after you leave.",
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    fetch("/api/closet")
      .then((r) => r.json())
      .then((r) => {
        if (active) {
          setAi(r.aiAvailable === true);
          setImageAi(r.imageAvailable === true);
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
      writeCloset({ items, saved }).catch(() =>
        setStorageError(
          "Storage is full or unavailable. Keep this page open, and download any outfit images you want to keep.",
        ),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [items, saved, ready]);
  useEffect(() => {
    if (draft && !editor.current?.open) editor.current?.showModal();
    if (!draft && editor.current?.open) editor.current.close();
  }, [draft]);
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
    setBusy("photo");
    setError("");
    try {
      const image = await photoData(file);
      setEditorError("");
      setDraft((current) =>
        current
          ? { ...current, image, sample: undefined }
          : { ...blank(), image },
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "This photo could not be read.",
      );
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
      setOutfit({
        ...next,
        pieces: items
          .filter((i) => next.itemIds.includes(i.id))
          .map((i) => ({ ...i })),
      });
      setTab("outfit");
      event("outfit_generated", { occasion: preferences.occasion });
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
    <div className={styles.app} aria-busy={Boolean(busy)}>
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
              const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1;
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
                      shoes. Add a photo or describe each piece.
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
                    <div className={styles.samplePrompt}>
                      <span>Just exploring?</span>
                      <button
                        className={styles.quiet}
                        onClick={() => {
                          setItems(sampleCloset.map((i) => ({ ...i })));
                          setMessage(
                            "Sample wardrobe loaded. Replace these pieces with your own when you’re ready.",
                          );
                        }}
                      >
                        Try the sample closet ↗
                      </button>
                    </div>
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
                            {item.sample && (
                              <span className={styles.sampleBadge}>SAMPLE</span>
                            )}
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
                    {busy === "outfit"
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
                  <div className={styles.outfitBoard}>
                    {selected.map((item) => (
                      <div key={item.id}>
                        <Photo item={item} />
                        <span>{item.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className={styles.explanation}>
                    <p className={styles.eyebrow}>WHY IT WORKS</p>
                    <p>{outfit.reason}</p>
                    <p className={styles.tip}>{outfit.tips}</p>
                  </div>
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
                    {imageAi && (
                      <button
                        className={styles.secondary}
                        onClick={generateImage}
                        disabled={Boolean(busy)}
                      >
                        {busy === "image"
                          ? "Creating image…"
                          : outfit.image
                            ? "Recreate outfit image"
                            : "Create an outfit image ✧"}
                      </button>
                    )}
                    {outfit.image && (
                      <a
                        className={styles.quiet}
                        href={outfit.image}
                        download="wera-outfit.png"
                      >
                        Download image ↓
                      </a>
                    )}
                  </div>
                  {imageAi && (
                    <p className={styles.hint}>
                      Creating an image sends only the selected pieces and their
                      photos to Google. Usually takes 20–60 seconds.
                    </p>
                  )}
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
              {busy === "outfit"
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
                ? "AI styling sends clothing details and your preferences to Google. Photos are sent only when you ask to identify a piece or create an image."
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
        {!standalone && (
          <a href="/closet" target="_blank" rel="noopener noreferrer">
            Open the app ↗
          </a>
        )}
      </footer>
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
                {ai && draft.image.startsWith("data:") && (
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={Boolean(busy)}
                    onClick={analyze}
                  >
                    {busy === "analyze"
                      ? "Looking at your piece…"
                      : "Identify with AI ✧"}
                  </button>
                )}
                <p className={styles.hint}>
                  {ai
                    ? "AI identification sends this photo to Google. Check and edit the suggested details before saving."
                    : "Describe your piece using the fields alongside it. A photo is optional."}
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
