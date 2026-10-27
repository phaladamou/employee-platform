// app/(chat)/settings/general/general-form.tsx
"use client";

import {
  AtSign,
  Calendar,
  Clock,
  ExternalLinkIcon,
  GithubIcon,
  Globe,
  LinkedinIcon,
  Monitor,
  Pencil,
  TwitterIcon,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { Card } from "@/components/workspace/settings/shared/card";
import { Row } from "@/components/workspace/settings/shared/row";
import { SectionLabel } from "@/components/workspace/settings/shared/section-label";
import { getChatHistoryPaginationKey } from "@/components/workspace/sidebar-history";
import { useIntl } from "@/components/intl-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatTimezoneLabel(tz: string): string {
  const offset =
    Intl.DateTimeFormat("en", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? "";

  const country = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;

  if (country === "UTC" || country === "Etc") {
    return "UTC — Temps universel";
  }

  return `${offset} — ${country}`;
}

function Lightbox({
  alt,
  onClose,
  src,
}: {
  alt: string;
  onClose: () => void;
  src: string;
}) {
  return (
    <button
      aria-label="Close lightbox"
      className="fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-sm p-8 w-full cursor-default"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        }
      }}
      type="button"
    >
      <span className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors cursor-pointer">
        <X className="size-5" />
      </span>
      <span className="mt-[10vh] w-64 h-64 rounded-2xl overflow-hidden shadow-2xl pointer-events-none">
        <Image
          alt={alt}
          className="h-full w-full object-cover"
          height={256}
          src={src}
          width={256}
        />
      </span>
    </button>
  );
}

export function GeneralForm({
  initialPreferences,
  user,
}: {
  initialPreferences: Record<string, unknown>;
  user: {
    bio: string | null;
    createdAt: string | null;
    email: string;
    id: string;
    image: string | null;
    name: string;
  };
}) {
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const { formatDate, timezone } = useIntl();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate } = useSWRConfig();
  const currentLocale = useLocale();
  const { update } = useSession();
  const [selectedLocale, setSelectedLocale] = useState(currentLocale);
  const t = useTranslations("settings");

  const [bio, setBio] = useState(user.bio ?? "");
  const [image, setImage] = useState(user.image ?? "");
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [name, setName] = useState(user.name ?? "");
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [linkSafetyDisabled, setLinkSafetyDisabled] = useState(
    (initialPreferences.linkSafetyDisabled as boolean) ?? false
  );

  const linkedAccounts =
    (initialPreferences.linkedAccounts as Record<
      string,
      { id: string; name: string }
    >) ?? {};

  function changeLocale(newLocale: string) {
    setSelectedLocale(newLocale);
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`;
    savePrefs({
      ...initialPreferences,
      linkedAccounts,
      language: newLocale,
      theme,
      timezone,
      linkSafetyDisabled,
    });
    window.location.reload();
  }

  async function savePrefs(data: Record<string, unknown>) {
    try {
      const response = await fetch("/api/settings", {
        body: JSON.stringify({ preferences: data }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error(`Failed to save preferences: ${response.status}`);
      }

      router.refresh();
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Failed to save preferences");
    }
  }

  async function saveProfile(fields: {
    bio?: string;
    image?: string;
    name?: string;
  }) {
    try {
      const response = await fetch("/api/settings", {
        body: JSON.stringify(fields),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error(`Failed to save profile: ${response.status}`);
      }

      const data = await response.json();

      if (data.user) {
        await update({
          name: data.user.name,
          image: data.user.image,
          email: data.user.email,
        });
      }

      await mutate("/api/user");

      router.refresh();
    } catch (err) {
      console.error("Save failed:", err);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setImage(dataUrl);
      await saveProfile({ image: dataUrl });
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  }

  function handleRemovePhoto() {
    setImage("");
    saveProfile({ image: "" });
  }

  const handleDeleteAll = () => {
    setShowDeleteAllDialog(false);
    mutate(unstable_serialize(getChatHistoryPaginationKey), [], {
      revalidate: false,
    });
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history`, {
      method: "DELETE",
    });
    toast.success("All chats deleted");
  };

  return (
    <div className="space-y-8">
      <SectionLabel>{t("general")}</SectionLabel>

      {/* Profile */}
      <Card>
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
            {t("profile")}
          </h3>
          <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t("profileDescription")}
          </p>
        </div>
        <div className="px-5 py-5">
          <div className="flex items-start gap-5">
            <div className="shrink-0">
              <div className="relative group">
                {isUploading ? (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                ) : image ? (
                  <button
                    aria-label={t("viewPhoto")}
                    className="block h-20 w-20 rounded-2xl overflow-hidden ring-1 ring-neutral-200 dark:ring-neutral-700 hover:ring-neutral-400 dark:hover:ring-neutral-500 transition-all cursor-zoom-in"
                    onClick={() => setLightboxOpen(true)}
                    type="button"
                  >
                    <Image
                      alt="Avatar"
                      className="h-full w-full object-cover"
                      height={80}
                      src={image}
                      width={80}
                    />
                  </button>
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400">
                    <Upload className="size-5" />
                  </div>
                )}
                <button
                  aria-label={t("uploadPhoto")}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-white shadow-md hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <Upload className="size-3.5" />
                </button>
                <input
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  type="file"
                />
              </div>
              <button
                className="mt-2 text-[14px] font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                {t("change")}
              </button>
              {image && (
                <button
                  className="mt-1 block text-[14px] text-red-500 hover:text-red-400 transition-colors"
                  onClick={handleRemovePhoto}
                  type="button"
                >
                  {t("remove")}
                </button>
              )}
            </div>

            <div className="min-w-0 flex-1 pt-1">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    className="w-full rounded-lg border border-neutral-200 bg-transparent px-2.5 py-1.5 text-[16px] font-semibold text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-700 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setIsEditingName(false);
                        saveProfile({ name });
                      }
                      if (e.key === "Escape") {
                        setName(user.name ?? "");
                        setIsEditingName(false);
                      }
                    }}
                    placeholder={t("setYourName")}
                    value={name}
                  />
                  <button
                    className="text-[14px] font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors shrink-0"
                    onClick={() => {
                      setIsEditingName(false);
                      saveProfile({ name });
                    }}
                    type="button"
                  >
                    {t("save")}
                  </button>
                </div>
              ) : (
                <button
                  className="group inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
                  onClick={() => setIsEditingName(true)}
                  type="button"
                >
                  <p className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
                    {name || t("setYourName")}
                  </p>
                  <Pencil className="size-3.5 text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity dark:text-neutral-600" />
                </button>
              )}
              <p className="mt-0.5 flex items-center gap-1.5 text-[16px] text-neutral-500 dark:text-neutral-400">
                <AtSign className="size-3 shrink-0" />
                {user.email ?? "—"}
              </p>
              {isEditingBio ? (
                <div className="mt-2 flex items-start gap-2">
                  <textarea
                    autoFocus
                    className="w-full rounded-lg border border-neutral-200 bg-transparent px-2.5 py-1.5 text-[16px] text-neutral-600 placeholder:text-neutral-400 resize-none dark:border-neutral-700 dark:text-neutral-400 dark:placeholder:text-neutral-500"
                    onChange={(e) => setBio(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setBio(user.bio ?? "");
                        setIsEditingBio(false);
                      }
                    }}
                    placeholder={t("addBio")}
                    rows={2}
                    value={bio}
                  />
                  <button
                    className="text-[14px] font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors shrink-0 mt-1.5"
                    onClick={() => {
                      setIsEditingBio(false);
                      saveProfile({ bio });
                    }}
                    type="button"
                  >
                    {t("save")}
                  </button>
                </div>
              ) : (
                <button
                  className="group mt-1.5 block w-full text-left"
                  onClick={() => setIsEditingBio(true)}
                  type="button"
                >
                  <p className="text-[16px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    {bio || t("addBio")}
                  </p>
                </button>
              )}
            </div>
          </div>
          {lightboxOpen && image && (
            <Lightbox
              alt="Avatar"
              onClose={() => setLightboxOpen(false)}
              src={image}
            />
          )}
        </div>
        <Row
          icon={Calendar}
          label={t("memberSince")}
          value={formatDate(user.createdAt ?? null)}
        />
      </Card>

      {/* Localization */}
      <Card>
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
            {t("localization")}
          </h3>
          <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t("localizationDescription")}
          </p>
        </div>
        <Row
          action={
            <select
              className="rounded-lg border border-neutral-200 bg-transparent px-2.5 py-1.5 text-[14px] text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              onChange={(e) => changeLocale(e.target.value)}
              value={selectedLocale}
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="zh">中文</option>
            </select>
          }
          icon={Globe}
          label={t("language")}
          value={
            selectedLocale === "fr"
              ? "Français"
              : selectedLocale === "zh"
                ? "中文"
                : "English"
          }
        />
        <Row
          icon={Clock}
          label={t("timezone")}
          value={mounted ? formatTimezoneLabel(timezone) : "—"}
        />
      </Card>

      {/* Appearance */}
      <Card>
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
            {t("appearance")}
          </h3>
          <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t("appearanceDescription")}
          </p>
        </div>
        <Row
          action={
            <select
              className="rounded-lg border border-neutral-200 bg-transparent px-2.5 py-1.5 text-[14px] text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              onChange={(e) => {
                setTheme(e.target.value);
                savePrefs({
                  ...initialPreferences,
                  linkedAccounts,
                  language: selectedLocale,
                  theme: e.target.value,
                  timezone,
                  linkSafetyDisabled,
                });
              }}
              value={theme}
            >
              <option value="system">{t("system")}</option>
              <option value="light">{t("light")}</option>
              <option value="dark">{t("dark")}</option>
            </select>
          }
          icon={Monitor}
          label={t("theme")}
          value={
            theme === "system"
              ? t("system")
              : theme === "dark"
                ? t("dark")
                : t("light")
          }
        />
      </Card>

      {/* Linked Accounts */}
      <Card>
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
            Comptes liés
          </h3>
          <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            Connectez vos comptes pour permettre à Employee d'agir en votre nom.
          </p>
        </div>
        <Row
          action={
            linkedAccounts.linkedin ? (
              <button
                className="text-[13px] text-red-500 hover:text-red-400 transition-colors"
                onClick={() => {
                  const { linkedin: _l, ...newLinked } = linkedAccounts;
                  savePrefs({
                    ...initialPreferences,
                    linkedAccounts: newLinked,
                    language: selectedLocale,
                    theme,
                    timezone,
                    linkSafetyDisabled,
                  });
                }}
                type="button"
              >
                Déconnecter
              </button>
            ) : (
              <button
                className="text-[13px] text-primary hover:text-primary/80 transition-colors"
                onClick={() =>
                  window.open(
                    "/api/link/linkedin",
                    "link-linkedin",
                    "width=600,height=700"
                  )
                }
                type="button"
              >
                Connecter
              </button>
            )
          }
          icon={LinkedinIcon}
          label="LinkedIn"
          value={
            linkedAccounts.linkedin
              ? `Connecté — ${linkedAccounts.linkedin.name}`
              : "Non connecté"
          }
        />
        <Row
          action={
            linkedAccounts.github ? (
              <button
                className="text-[13px] text-red-500 hover:text-red-400 transition-colors"
                onClick={() => {
                  const { github: _g, ...newLinked } = linkedAccounts;
                  savePrefs({
                    ...initialPreferences,
                    linkedAccounts: newLinked,
                    language: selectedLocale,
                    theme,
                    timezone,
                    linkSafetyDisabled,
                  });
                }}
                type="button"
              >
                Déconnecter
              </button>
            ) : (
              <button
                className="text-[13px] text-primary hover:text-primary/80 transition-colors"
                onClick={() =>
                  window.open(
                    "/api/link/github",
                    "link-github",
                    "width=600,height=700"
                  )
                }
                type="button"
              >
                Connecter
              </button>
            )
          }
          icon={GithubIcon}
          label="GitHub"
          value={
            linkedAccounts.github
              ? `Connecté — ${linkedAccounts.github.name}`
              : "Non connecté"
          }
        />
        <Row
          action={
            linkedAccounts.twitter ? (
              <button
                className="text-[13px] text-red-500 hover:text-red-400 transition-colors"
                onClick={() => {
                  const { twitter: _t, ...newLinked } = linkedAccounts;
                  savePrefs({
                    ...initialPreferences,
                    linkedAccounts: newLinked,
                    language: selectedLocale,
                    theme,
                    timezone,
                    linkSafetyDisabled,
                  });
                }}
                type="button"
              >
                Déconnecter
              </button>
            ) : (
              <a
                className="text-[13px] text-primary hover:text-primary/80 transition-colors"
                href="/api/link/twitter"
                rel="noopener noreferrer"
                target="_blank"
              >
                Connecter
              </a>
            )
          }
          icon={TwitterIcon}
          label="X"
          value={
            linkedAccounts.twitter
              ? `Connecté — ${linkedAccounts.twitter.name}`
              : "Non connecté"
          }
        />
      </Card>

      {/* Link Safety */}
      <Card>
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
            {t("linkSafety")}
          </h3>
          <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t("linkSafetyDescription")}
          </p>
        </div>
        <Row
          action={
            <button
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                linkSafetyDisabled
                  ? "bg-neutral-300 dark:bg-neutral-600"
                  : "bg-primary"
              }`}
              onClick={() => {
                const newVal = !linkSafetyDisabled;
                setLinkSafetyDisabled(newVal);
                savePrefs({
                  ...initialPreferences,
                  linkedAccounts,
                  language: selectedLocale,
                  theme,
                  timezone,
                  linkSafetyDisabled: newVal,
                });
              }}
              type="button"
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  linkSafetyDisabled ? "translate-x-1" : "translate-x-6"
                }`}
              />
            </button>
          }
          icon={ExternalLinkIcon}
          label={t("linkSafety")}
          value={linkSafetyDisabled ? t("disabled") : t("enabled")}
        />
      </Card>

      {/* Danger Zone */}
      <Card>
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-[16px] font-semibold text-red-600 dark:text-red-400">
            {t("dangerZone")}
          </h3>
          <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t("dangerZoneDescription")}
          </p>
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[14px] font-medium text-neutral-900 dark:text-neutral-100">
              {t("deleteAllChats")}
            </p>
            <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t("deleteAllChatsDescription")}
            </p>
          </div>
          <button
            className="rounded-lg bg-red-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-red-700 transition-colors"
            onClick={() => setShowDeleteAllDialog(true)}
            type="button"
          >
            {t("deleteAll")}
          </button>
        </div>
      </Card>

      <AlertDialog
        onOpenChange={setShowDeleteAllDialog}
        open={showDeleteAllDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteAllConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteAllConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll}>
              {t("deleteAll")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}