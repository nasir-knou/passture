declare module 'katex' {
  export interface KatexOptions {
    displayMode?: boolean;
    output?: 'html' | 'mathml' | 'htmlAndMathml';
    strict?: boolean | 'warn' | 'ignore';
    throwOnError?: boolean;
    trust?: boolean;
  }

  const katex: {
    renderToString(value: string, options?: KatexOptions): string;
  };

  export default katex;
}

declare module 'katex/dist/katex.min.css';
