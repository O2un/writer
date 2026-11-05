# writer

블로그 글의 초안 작성, 검토, 수정을 돕는 LLM 에이전트다. MCP 서버로 동작해서 Claude Code 같은 MCP 클라이언트에서 도구로 호출한다.

지금은 규칙 검사 도구 `check_post`와 검토 도구 `review_post`까지 구현되어 있다. 수정 루프와 초안 작성은 [PRD](docs/PRD.md)의 M3~M4에서 이어진다. 규칙과 설계 판단은 [docs/rules.md](docs/rules.md)에 있다.

## 요구 사항

- Node.js 22 이상
- 검사할 사이트의 레포와, 글의 frontmatter를 정의한 JSON Schema 파일

Astro 사이트라면 `astro sync`, `astro dev`, `astro build` 중 하나를 돌렸을 때 스키마 파일이 `.astro/collections/`에 만들어진다.

## 설치

```sh
npm install
npm run build
```

## 설정

환경변수로 받는다. 경로는 `SITE_ROOT` 기준이고, 생략하면 Astro 기본값을 쓴다.

| 변수 | 기본값 | 설명 |
|---|---|---|
| `SITE_ROOT` | 필수 | 사이트 레포 루트 |
| `WRITER_CONTENT_DIR` | `src/content/blog` | 글 폴더 |
| `WRITER_SCHEMA` | `.astro/collections/blog.schema.json` | frontmatter JSON Schema |
| `WRITER_GUIDE` | `.claude/skills/devlog-content-writing/SKILL.md` | LLM 비평의 기준이 되는 글쓰기 안내 문서. 호출할 때마다 읽으므로 고치면 바로 반영된다. 없어도 서버는 시작하고 `review_post`만 오류를 낸다 |
| `LLM_PROVIDER` | `claude-code` | LLM 호출 방식. `claude-code`(Claude 구독) 또는 `anthropic-api`(API 키, 사용량 과금) |
| `WRITER_MODEL` | Provider 기본값 | 모델 ID |
| `WRITER_CLAUDE_BIN` | `claude` | `claude-code` Provider가 실행할 파일. 셸을 거치지 않으므로 npm으로 설치한 Windows에서는 `claude.exe`의 전체 경로를 적는다 |

값이 잘못되면 서버가 시작하지 않고 stderr에 이유를 출력한다.

`claude-code` Provider는 본인이 개인 툴로 쓰는 용도다. 남이 쓸 때는 `anthropic-api` Provider를 쓴다.

## Claude Code에 연결

```sh
claude mcp add --scope local writer -e SITE_ROOT=/path/to/site -- node /path/to/writer/dist/index.js
```

서버는 시작할 때 스키마를 한 번만 읽는다. 코드를 고치면 `npm run build`를, 사이트 스키마가 바뀌면 스키마 파일을 다시 만든 뒤 세션을 다시 시작한다.

## 도구

### `check_post`

글 하나를 규칙으로 검사한다. LLM을 쓰지 않고 파일을 고치지 않는다.

| 입력 | 설명 |
|---|---|
| `path` | 글 폴더 기준 경로. 폴더(`notes/hello`)나 파일(`notes/hello/index.md`) |
| `template` | 글 템플릿. 생략하면 `article` |

입력 `{ "path": "sample/broken" }`의 응답이다. 줄 번호는 원문 기준이다.

```
sample/broken/index.md: error 3, warning 1, info 0
L1 [error] frontmatter: must have required property 'description'
L4 [warning] frontmatter: unknown field 'thumbnial': not in the site schema
L5 [error] frontmatter: thumbnail file not found: ./없는파일.png
L6 [error] frontmatter: accent: must be equal to one of the allowed values
```

같은 내용이 `structuredContent`로도 나간다. `passed`는 error와 warning이 하나도 없을 때 `true`다.

```json
{
  "post": "sample/broken/index.md",
  "template": "article",
  "passed": false,
  "counts": { "error": 3, "warning": 1, "info": 0 },
  "violations": [
    { "rule": "frontmatter", "severity": "error", "message": "must have required property 'description'", "line": 1 }
  ]
}
```

(`violations`는 첫 항목만 옮겼다.)

없는 글이나 글 폴더 밖의 경로는 `isError: true`와 함께 `post not found: sample/nope`처럼 답한다.

### `review_post`

`check_post`와 같은 규칙 검사에 LLM 비평을 더한다. 파일을 고치지 않는다. 입력은 `check_post`와 같다. LLM을 호출하므로 사용 한도나 요금이 든다.

비평 기준은 `WRITER_GUIDE` 문서에 템플릿의 `criteria`를 더한 것이다. 규칙 검사에서 위반이 나와도 비평은 돌린다.

응답은 `check_post`에 `issues`가 붙은 모양이다. `passed`는 규칙 검사를 통과하고 `issues`가 비어 있을 때 `true`다. 지적의 `severity`는 작성자가 볼 우선순위다. 거짓일 가능성이 높은 주장은 `error`, 나머지는 `warning`이다. 비평 지적은 자동으로 고치지 않는다.

```json
{
  "post": "sample/clean/index.md",
  "template": "article",
  "passed": false,
  "counts": { "error": 0, "warning": 0, "info": 0 },
  "violations": [],
  "issues": [
    { "severity": "error", "quote": "이건 뒤에서 다룬다", "problem": "forward reference", "suggestion": "remove the sentence" }
  ]
}
```

(위 값은 형식을 보여 주는 예시다.)

## 개발

```sh
npm test            # 테스트
npm run typecheck   # 타입 검사
npm run dev         # 빌드 없이 서버 실행
```

```
src/
├─ index.ts        실행 진입점. 설정을 읽고 stdio로 서버를 연결
├─ config.ts       환경변수와 스키마 파일 읽기
├─ content/        글 찾기, frontmatter 자르기와 해석, 본문 파싱
├─ rules/          규칙과 실행기. 글을 받아 위반 목록을 돌려주는 순수 함수
├─ templates/      글 템플릿 목록
├─ llm/            LLM Provider
├─ review/         LLM 비평 요청과 응답 형식
└─ mcp/            MCP 서버와 도구 등록
```
