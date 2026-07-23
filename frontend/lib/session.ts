/**
 * Placeholder hasta que exista autenticación real (fe_specs.md § 7, ADR-2/ADR-3).
 * El día que haya sesión de Cognito, esto se reemplaza por la lectura del `sub`
 * del usuario autenticado — es el único punto que el resto de la UI debe tocar.
 */
export function getCurrentUserId(): string {
  return 'me';
}
