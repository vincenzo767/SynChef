import { useEffect, useRef, useState, type FormEvent } from "react";
import { LuImagePlus, LuLock, LuEarth, LuTrash2 } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextArea, TextField } from "@/components/ui/Field";
import { Alert, Tabs } from "@/components/ui/primitives";
import { dishApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/client";
import { WORLD_COUNTRIES } from "@/lib/countries";
import type { Dish, DishInput } from "@/lib/api/types";
import s from "./community.module.css";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface FormState {
  title: string;
  country: string;
  ingredients: string;
  procedures: string;
  privacy: "PUBLIC" | "PRIVATE";
  imageUrl: string | null;
}

const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

function toForm(dish: Dish | null): FormState {
  return {
    title: dish?.title ?? "",
    country: dish?.country ?? "",
    ingredients: dish?.ingredients.join("\n") ?? "",
    procedures: dish?.procedures.join("\n") ?? "",
    privacy: dish?.privacy ?? "PUBLIC",
    imageUrl: dish?.imageUrl ?? null
  };
}

/** Create or edit a community dish. Photos are uploaded as files (not embedded in the record). */
export function DishEditor({ open, dish, onClose, onSaved }: { open: boolean; dish: Dish | null; onClose: () => void; onSaved: (dish: Dish) => void }) {
  const [form, setForm] = useState<FormState>(() => toForm(dish));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(toForm(dish));
      setErrors({});
      setFormError(null);
    }
  }, [open, dish]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      setErrors((e) => ({ ...e, imageUrl: "Use a JPEG, PNG, WEBP or GIF image." }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrors((e) => ({ ...e, imageUrl: "Images must be 5 MB or smaller." }));
      return;
    }
    setUploading(true);
    try {
      const { url } = await dishApi.uploadImage(file);
      set("imageUrl", url);
    } catch (e) {
      setErrors((er) => ({ ...er, imageUrl: toApiError(e).message }));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (form.title.trim().length < 3) next.title = "Give your dish a name (3+ characters)";
    if (form.country.trim().length < 2) next.country = "Where is this dish from?";
    if (lines(form.ingredients).length === 0) next.ingredients = "Add at least one ingredient";
    if (lines(form.procedures).length === 0) next.procedures = "Add at least one step";
    if (lines(form.ingredients).length > 60) next.ingredients = "Up to 60 ingredients";
    if (lines(form.procedures).length > 60) next.procedures = "Up to 60 steps";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    const body: DishInput = {
      title: form.title.trim(),
      country: form.country.trim(),
      ingredients: lines(form.ingredients),
      procedures: lines(form.procedures),
      privacy: form.privacy,
      imageUrl: form.imageUrl
    };
    setSaving(true);
    setFormError(null);
    try {
      const saved = dish ? await dishApi.update(dish.id, body) : await dishApi.create(body);
      onSaved(saved);
    } catch (e) {
      const err = toApiError(e);
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={saving}
      width={640}
      title={dish ? "Edit your dish" : "Share a dish"}
      description="Tell the community what you cooked. One ingredient or step per line."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="dish-form" loading={saving} disabled={uploading}>
            {dish ? "Save changes" : "Share dish"}
          </Button>
        </>
      }
    >
      <form id="dish-form" className="stack" onSubmit={submit} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <div className={s.formGrid}>
          <TextField label="Dish name" value={form.title} onChange={(e) => set("title", e.target.value)} error={errors.title} maxLength={180} data-autofocus />
          <TextField label="Country of origin" value={form.country} onChange={(e) => set("country", e.target.value)} error={errors.country} maxLength={120} list="dish-countries" />
          <datalist id="dish-countries">
            {WORLD_COUNTRIES.map((c) => (
              <option key={c.code} value={c.name} />
            ))}
          </datalist>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: "var(--fs-sm)" }}>Photo</span>
          <div className={s.imagePicker}>
            {form.imageUrl ? <img className={s.imagePreview} src={form.imageUrl} alt="Dish preview" /> : <span className={s.imagePreview} aria-hidden="true" />}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => void pickImage(e.target.files?.[0])} />
            <Button variant="secondary" size="sm" icon={<LuImagePlus />} loading={uploading} onClick={() => fileRef.current?.click()}>
              {form.imageUrl ? "Replace photo" : "Upload photo"}
            </Button>
            {form.imageUrl && (
              <Button variant="ghost" size="sm" icon={<LuTrash2 />} onClick={() => set("imageUrl", null)}>
                Remove
              </Button>
            )}
          </div>
          {errors.imageUrl && <span style={{ color: "var(--danger)", fontSize: "var(--fs-xs)" }}>{errors.imageUrl}</span>}
        </div>
        <TextArea
          label="Ingredients"
          value={form.ingredients}
          onChange={(e) => set("ingredients", e.target.value)}
          error={errors.ingredients}
          hint={`${lines(form.ingredients).length} ingredients`}
          rows={5}
          placeholder={"500 g pork belly\n2 tbsp soy sauce"}
        />
        <TextArea
          label="Steps"
          value={form.procedures}
          onChange={(e) => set("procedures", e.target.value)}
          error={errors.procedures}
          hint={`${lines(form.procedures).length} steps`}
          rows={6}
          placeholder={"Marinate the pork for 30 minutes.\nSimmer until tender."}
        />
        <div className="stack" style={{ gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: "var(--fs-sm)" }}>Who can see it</span>
          <Tabs
            label="Privacy"
            value={form.privacy}
            onChange={(v) => set("privacy", v)}
            options={[
              { value: "PUBLIC", label: (<><LuEarth aria-hidden="true" style={{ display: "inline", verticalAlign: "-2px" }} /> Community</>) },
              { value: "PRIVATE", label: (<><LuLock aria-hidden="true" style={{ display: "inline", verticalAlign: "-2px" }} /> Only me</>) }
            ]}
          />
        </div>
      </form>
    </Modal>
  );
}
