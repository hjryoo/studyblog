import { schedule } from '@netlify/functions';
import fetch from 'node-fetch'; // Netlify 함수에서는 node-fetch를 명시적으로 import 해주는 것이 안정적입니다.

// ❗️ 2단계에서 복사한 본인의 Netlify 빌드 훅 URL로 교체하세요!
const BUILD_HOOK_URL = 'https://api.netlify.com/build_hooks/xxxxxxxxxxxxxxxxxxxxxxxx';

// schedule로 핸들러를 감싸서 export하는 방식입니다.
export const handler = schedule('0 22 * * *', async () => {
  try {
    const response = await fetch(BUILD_HOOK_URL, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`Failed to trigger build: ${response.statusText}`);
    }

    console.log('Successfully triggered a new build.');
    
    return {
      statusCode: 200,
      body: 'Build triggered.',
    };

  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: `Error triggering build: ${error.message}`,
    };
  }
});