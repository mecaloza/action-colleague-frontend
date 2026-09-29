import Link from "next/link";
import { Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Link to the course creation flow, used in the panel, the library and its empty state. */
export function NewCourseButton({ size }: { size?: ButtonProps["size"] }) {
  return (
    <Button variant="accent" size={size} asChild>
      <Link href="/admin/courses/new">
        <Plus /> Nuevo curso
      </Link>
    </Button>
  );
}
