// Next.js 14 방식의 마산제일여고 POST 요청 처리 함수
export async function POST(request) {
  const body = await request.json();
  const utterance = body.userRequest?.utterance || "";
  const dateOffset = utterance.indexOf("내일") !== -1 ? 1 : 0;

  const date = new Date();
  date.setHours(date.getHours() + 9);
  date.setDate(date.getDate() + dateOffset);
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dayName = dayNames[date.getDay()];

  const apiKey = "2fcbf1dca2cd46bdaa2c75ea24a33696";
  const eduCode = "S10";
  const schoolCode = "9010093"; // 마산제일여고 코드 고정
  const baseUrl = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${apiKey}&Type=json&ATPT_OFCDC_SC_CODE=${eduCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_YMD=${ymd}`;

  const [lunchRes, dinnerRes] = await Promise.all([
    fetch(baseUrl + "&MMEAL_SC_CODE=2"),
    fetch(baseUrl + "&MMEAL_SC_CODE=3")
  ]);

  const [lunchJson, dinnerJson] = await Promise.all([
    lunchRes.json(),
    dinnerRes.json()
  ]);

  function parseDish(json) {
    try {
      return json.mealServiceDietInfo[1].row[0].DDISH_NM
        .replace(/<br\/>/g, "\n")
        .replace(/\([^)]*\)/g, "")
        .trim();
    } catch(e) {
      return "정보 없음";
    }
  }

  const lunch = parseDish(lunchJson);
  const dinner = parseDish(dinnerJson);

  const msg = `🍱마산제일여고 ${month}월 ${day}일 (${dayName}) 급식\n─────────────\n🌞 점심\n${lunch}\n─────────────\n🌙 석식\n${dinner}`;

  // Next.js 표준 JSON 응답 반환
  return Response.json({
    version: "2.0",
    template: {
      outputs: [{ simpleText: { text: msg } }]
    }
  });
}
