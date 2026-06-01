export async function POST(request) {
  const body = await request.json();
  const utterance = body.userRequest?.utterance || "";
  const params = body.action?.params || {};

  function getKST() {
    const now = new Date();
    now.setHours(now.getHours() + 9);
    return now;
  }

  function toYmd(date) {
    return date.toISOString().slice(0, 10).replace(/-/g, "");
  }

  // 날짜 라벨 예시: 6월 1일 (월)
  function dateLabel(date) {
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    return `${date.getMonth() + 1}월 ${date.getDate()}일 (${dayNames[date.getDay()]})`;
  }

  // 이번 주 월~금요일까지의 날짜 배열 구하기
  function getThisWeekDates(today) {
    const day = today.getDay();
    const mon = new Date(today);
    mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    const dates = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      dates.push(d);
    }
    return dates;
  }

  // NEIS API 호출 함수 (마산제일여고 코드 고정)
  async function getMeal(ymd, mealCode) {
    const apiKey = "2fcbf1dca2cd46bdaa2c75ea24a33696";
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${apiKey}&Type=json&ATPT_OFCDC_SC_CODE=S10&SD_SCHUL_CODE=9010093&MLSV_YMD=${ymd}&MMEAL_SC_CODE=${mealCode}`;
    const res = await fetch(url);
    const json = await res.json();
    try {
      return json.mealServiceDietInfo[1].row[0].DDISH_NM
        .replace(/<br\/>/g, "\n")
        .replace(/\([^)]*\)/g, "")
        .trim();
    } catch (e) {
      return "정보 없음"; // 조식이 없거나 급식이 없는 날 예외 처리
    }
  }

  const today = getKST();
  let msg = "";

  // 1. 카카오톡 날짜 플러그인(params.date)으로 특정 날짜를 물어봤을 때
  if (params.date) {
    const dateObj = JSON.parse(params.date);
    const parts = dateObj.value.split("-");
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    const target = new Date(year, month - 1, day);
    const ymd = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

    const [breakfast, lunch, dinner] = await Promise.all([
      getMeal(ymd, 1),
      getMeal(ymd, 2),
      getMeal(ymd, 3)
    ]);

    msg = `🍱 마산제일여고 ${month}월 ${day}일 (${dayNames[target.getDay()]}) 급식\n─────────────\n🌅 조식\n${breakfast}\n─────────────\n🌞 점심\n${lunch}\n─────────────\n🌙 석식\n${dinner}`;

  // 2. "이번주 중식", "이번주 석식" 등 주간 조회를 요청했을 때
  } else if (utterance.indexOf("이번주") !== -1) {
    const dates = getThisWeekDates(today);
    let mealCode = 2;
    let mealName = "중식";
    let emoji = "🌞";
    if (utterance.indexOf("조식") !== -1) { mealCode = 1; mealName = "조식"; emoji = "🌅"; }
    else if (utterance.indexOf("석식") !== -1) { mealCode = 3; mealName = "석식"; emoji = "🌙"; }

    const results = await Promise.all(
      dates.map(d => getMeal(toYmd(d), mealCode))
    );

    const mon = dates[0];
    const fri = dates[4];
    msg = `🍱 마산제일여고 이번주 ${mealName} (${mon.getMonth() + 1}/${mon.getDate()}~${fri.getMonth() + 1}/${fri.getDate()})\n`;
    dates.forEach((d, i) => {
      msg += `─────────────\n${emoji} ${dateLabel(d)}\n${results[i]}\n`;
    });

  // 3. 기본 "오늘 급식", "내일 급식"을 물어봤을 때 (점심/저녁 동시 출력)
  } else {
    const dateOffset = utterance.indexOf("내일") !== -1 ? 1 : 0;
    const target = new Date(today);
    target.setDate(today.getDate() + dateOffset);
    const [lunch, dinner] = await Promise.all([
      getMeal(toYmd(target), 2),
      getMeal(toYmd(target), 3)
    ]);
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    msg = `🍱 마산제일여고 ${target.getMonth() + 1}월 ${target.getDate()}일 (${dayNames[target.getDay()]}) 급식\n─────────────\n🌞 점심\n${lunch}\n─────────────\n🌙 석식\n${dinner}`;
  }

  return Response.json({
    version: "2.0",
    template: {
      outputs: [{ simpleText: { text: msg } }]
    }
  });
}
