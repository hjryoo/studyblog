import { schedule } from '@netlify/functions';

// ❗️ 2단계에서 복사한 본인의 Netlify 빌드 훅 URL로 교체하세요!
const BUILD_HOOK_URL = 'https://api.netlify.com/build_hooks/689dd4e52f89bd132cad8661';

// 스케줄 핸들러를 정의합니다.
const handler = async () => {
  // 빌드 훅 URL에 POST 요청을 보내서 새로운 빌드를 트리거합니다.
  const response = await fetch(BUILD_HOOK_URL, {
    method: 'POST'
  });

  if (response.ok) {
    console.log('Successfully triggered a new build.');
    return {
      statusCode: 200,
      body: 'Build triggered.',
    };
  } else {
    console.error('Failed to trigger build.', await response.text());
    return {
      statusCode: 500,
      body: 'Failed to trigger build.',
    };
  }
};

// Netlify에 이 함수를 어떤 스케줄로 실행할지 알려줍니다.
// 문법은 cron과 동일합니다. '0 22 * * *'는 매일 UTC 22:00에 실행됩니다.
export const config = {
  schedule: '0 22 * * *', // 한국 시간 오전 7시
};
export { handler };