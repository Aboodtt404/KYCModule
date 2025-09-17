import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Response { 'message' : string, 'success' : boolean }
export interface _SERVICE {
  'debug_print_otps' : ActorMethod<[], Array<[string, string, bigint]>>,
  'get_verified_phones' : ActorMethod<[], Array<string>>,
  'send_sms' : ActorMethod<[string], Response>,
  'verify_otp' : ActorMethod<[string, string], Response>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
