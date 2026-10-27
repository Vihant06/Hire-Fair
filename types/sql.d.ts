declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: any[]): void
    prepare(sql: string): {
      bind(params: any[]): void
      step(): boolean
      getAsObject(): Record<string, any>
      free(): void
    }
    export(): Uint8Array
    exec(sql: string): void
  }
  export default function initSqlJs(config: any): Promise<any>
}