export const idlFactory = ({ IDL }) => {
    const Response = IDL.Record({ 'message': IDL.Text, 'success': IDL.Bool });
    return IDL.Service({
        'debug_print_otps': IDL.Func([], [IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text, IDL.Nat64))], []),
        'get_verified_phones': IDL.Func([], [IDL.Vec(IDL.Text)], []),
        'send_sms': IDL.Func([IDL.Text], [Response], []),
        'verify_otp': IDL.Func([IDL.Text, IDL.Text], [Response], []),
    });
};
export const init = ({ IDL }) => { return []; };
