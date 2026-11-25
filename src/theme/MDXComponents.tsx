import MDXComponents from '@theme-original/MDXComponents';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Tech from '@site/src/components/TechLogo';
import { Alternativa, Angular, Ejercicio, Entrevista, Estado, Next, Resumen } from '@site/src/components/Callouts';

// Componentes disponibles en todos los .md/.mdx sin importarlos
export default {
  ...MDXComponents,
  Tabs,
  TabItem,
  Tech,
  Angular,
  Next,
  Entrevista,
  Alternativa,
  Ejercicio,
  Resumen,
  Estado,
};
