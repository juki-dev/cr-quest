import styles from './Disclaimer.module.css';

export function Disclaimer() {
  return (
    <p className={styles.disclaimer}>
      Esta plataforma es una herramienta de práctica para memorizar la secuencia de valoración.
      No sustituye la instrucción certificada ni constituye una evaluación formal.
    </p>
  );
}
