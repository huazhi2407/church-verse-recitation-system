declare module "bcryptjs" {
  export function hash(s: string, round: number): Promise<string>;
  export function hashSync(s: string, round?: number): string;
  export function compare(s: string, hash: string): Promise<boolean>;
  export function compareSync(s: string, hash: string): boolean;
  const bcrypt: {
    hash(s: string, round: number): Promise<string>;
    hashSync(s: string, round?: number): string;
    compare(s: string, hash: string): Promise<boolean>;
    compareSync(s: string, hash: string): boolean;
  };
  export default bcrypt;
}
