// types/react-19.d.ts
// Compatibilité React 19 : force children sur tous les composants
// Le temps que Radix UI et shadcn/ui migrent officiellement

import "react";

declare module "react" {
  type FunctionComponent<P = object> = (
    props: P & { children?: ReactNode }
  ) => ReactElement | null;

  interface ComponentClass<P = object> {
    new (
      props: P & { children?: ReactNode }
    ): Component<P> & { children?: ReactNode };
  }
}

declare module "react" {
  interface Attributes {
    children?: ReactNode;
  }
}
