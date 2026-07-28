// Map internal failures to human, bilingual copy. Office test 2026-07-28: a
// user was shown "agent.update is not a function" — engine text must never be
// the headline. The raw message is kept as a short technical detail line.
export function humanError(e, ctx = '') {
  const raw = (e && e.message) || String(e || '');
  const has = (re) => re.test(raw);
  let msg;
  if (has(/blurry|steady|too dark|overexposed/i)) {
    msg = raw; // server quality-copy is already human + actionable
  } else if (has(/too many|429|rate ?limit/i)) {
    msg = 'Too many attempts — wait a minute, then try again. · محاولات كثيرة — انتظر دقيقة ثم أعد المحاولة.';
  } else if (has(/fetch|network|timed? ?out|abort/i)) {
    msg = 'Connection problem — check your internet and try again. · مشكلة في الاتصال — تحقق من الإنترنت وأعد المحاولة.';
  } else if (has(/certificate|root key|not a function|agent|canister|reject/i)) {
    msg = 'The verification service had a hiccup — please try again. · حدث خلل مؤقت في خدمة التحقق — أعد المحاولة.';
  } else if (ctx === 'face' && has(/face/i)) {
    msg = "We couldn't see your face clearly — face the camera in good light. · لم نرَ وجهك بوضوح — واجه الكاميرا في إضاءة جيدة.";
  } else if (ctx === 'submit') {
    msg = 'Submission failed — nothing was lost. Please try again. · تعذر الإرسال — لم يُفقد شيء. أعد المحاولة.';
  } else if (ctx === 'sms') {
    msg = "The verification code couldn't be sent. You can skip this step for now. · تعذر إرسال الرمز. يمكنك تخطي هذه الخطوة الآن.";
  } else {
    msg = 'Something went wrong — please try again. · حدث خطأ — أعد المحاولة.';
  }
  return { msg, detail: msg === raw ? '' : raw.slice(0, 140) };
}
