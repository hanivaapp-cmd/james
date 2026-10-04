"use client";

import { Copy, ExternalLink, Trash } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getRepository } from "@/lib/data";
import { formatDateRange } from "@/lib/schedule/dates";
import type { ShareLink } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

export function ShareLinksSection() {
  const [links, setLinks] = useState<ShareLink[] | null>(null);

  useEffect(() => {
    getRepository()
      .listShareLinks()
      .then(setLinks)
      .catch((error) => toast.error("Links konnten nicht geladen werden", { description: errorMessage(error) }));
  }, []);

  if (!links) return <Spinner />;
  if (links.length === 0) return <p className="text-[13px] text-muted">Noch keine Links erstellt. Nutzen Sie „Teilen“ im Dienstplan.</p>;

  const url = (link: ShareLink) => `${window.location.origin}/share/${link.token}`;
  const remove = async (link: ShareLink) => {
    try {
      await getRepository().deleteShareLink(link.id);
      setLinks((l) => l?.filter((x) => x.id !== link.id) ?? null);
      toast.success("Link deaktiviert");
    } catch (error) {
      toast.error("Link konnte nicht gelöscht werden", { description: errorMessage(error) });
    }
  };

  return (
    <ul className="flex flex-col">
      {links.map((link) => {
        const expired = link.expires_at ? new Date(link.expires_at) < new Date() : false;
        return (
          <li key={link.id} className="flex items-center gap-2 border-b border-border py-2.5 last:border-0">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{link.title ?? "Dienstplan"}</div>
              <div className="text-xs text-muted">
                {formatDateRange(link.start_date, link.end_date)}
                {link.expires_at ? ` · gültig bis ${new Date(link.expires_at).toLocaleDateString("de-DE")}` : " · unbegrenzt"}
              </div>
            </div>
            {expired ? <Badge tone="danger">Abgelaufen</Badge> : null}
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Link kopieren"
              onClick={async () => {
                await navigator.clipboard.writeText(url(link));
                toast.success("Link kopiert");
              }}
            >
              <Copy />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Öffnen" onClick={() => window.open(url(link), "_blank")}>
              <ExternalLink />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Löschen" onClick={() => void remove(link)}>
              <Trash />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
