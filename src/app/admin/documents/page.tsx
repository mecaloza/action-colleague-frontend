"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { Document } from "@/lib/types";
import { Plus, FileText, Send, Check, PenLine } from "lucide-react";
import { useTranslations } from "next-intl";

export default function AdminDocumentsPage() {
  const t = useTranslations("adminDocuments");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [showGenerate, setShowGenerate] = useState(false);
  const [form, setForm] = useState({
    type: "offer_letter",
    employee_name: "",
    notes: "",
  });

  useEffect(() => {
    api.getDocuments().then(setDocuments);
  }, []);

  const handleGenerate = () => {
    const doc: Document = {
      id: `d${documents.length + 10}`,
      title: `${form.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} - ${form.employee_name}`,
      type: form.type as Document["type"],
      status: "generated",
      employee_name: form.employee_name,
      created_at: new Date().toISOString().split("T")[0],
      updated_at: new Date().toISOString().split("T")[0],
    };
    setDocuments([doc, ...documents]);
    setShowGenerate(false);
    setForm({ type: "offer_letter", employee_name: "", notes: "" });
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "draft": return <PenLine className="h-3.5 w-3.5" />;
      case "generated": return <FileText className="h-3.5 w-3.5" />;
      case "sent": return <Send className="h-3.5 w-3.5" />;
      case "signed": return <Check className="h-3.5 w-3.5" />;
      default: return <FileText className="h-3.5 w-3.5" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "signed": return "default" as const;
      case "sent": return "secondary" as const;
      case "generated": return "outline" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setShowGenerate(true)}>
          <Plus className="mr-2 h-4 w-4" /> {t("generateDocument")}
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.document")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("table.type")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("table.employee")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("table.date")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{doc.title}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="outline">{doc.type.replace(/_/g, " ")}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">{doc.employee_name}</TableCell>
                <TableCell>
                  <Badge variant={statusColor(doc.status)} className="gap-1">
                    {statusIcon(doc.status)}
                    {doc.status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell">{doc.created_at}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent>
          <DialogClose onClose={() => setShowGenerate(false)} />
          <DialogHeader>
            <DialogTitle>{t("modal.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="doc-type">{t("modal.documentType")}</Label>
              <Select
                id="doc-type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="offer_letter">Offer Letter</option>
                <option value="contract">Employment Contract</option>
                <option value="certificate">Training Certificate</option>
                <option value="warning">Warning Letter</option>
                <option value="promotion">Promotion Letter</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-emp">{t("modal.employeeName")}</Label>
              <Input
                id="doc-emp"
                value={form.employee_name}
                onChange={(e) => setForm({ ...form, employee_name: e.target.value })}
                placeholder={t("modal.employeeNamePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-notes">{t("modal.additionalNotes")}</Label>
              <Textarea
                id="doc-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t("modal.additionalNotesPlaceholder")}
              />
            </div>
            <Button className="w-full" onClick={handleGenerate} disabled={!form.employee_name}>
              {t("modal.generateWithAi")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
