export class ContractError extends Error{constructor(code,message,status=400){super(message);this.code=code;this.status=status;}}
export function fail(code,message,status=400){throw new ContractError(code,message,status);}
export function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
