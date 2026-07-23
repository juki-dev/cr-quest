interface NarrativeCardProps {
  narrative: string;
}

// Portado de mockup.html:352-361 (RQ-5.1).
export function NarrativeCard({ narrative }: NarrativeCardProps) {
  return (
    <div className="card">
      <p className="eyebrow">Caso publicado</p>
      <h1 className="cardTitle">Escenario de práctica</h1>
      <p className="narrative">{narrative}</p>
    </div>
  );
}
