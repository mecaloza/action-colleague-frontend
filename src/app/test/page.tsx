"use client";

import { CourseCreationManual } from "@/components/course-creation-manual";

export default function TestPage() {
  const handleComplete = (videoId: number) => {
    console.log("Course creation completed! Video ID:", videoId);
    alert(`¡Curso creado exitosamente! Video ID: ${videoId}`);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">
            Test: Creación Manual de Curso
          </h1>
          <p className="text-muted-foreground">
            Prueba del wizard completo de grabación + slides + composición
          </p>
        </div>

        <CourseCreationManual
          moduleId={999} // Test module ID
          onComplete={handleComplete}
        />
      </div>
    </div>
  );
}
