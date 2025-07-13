// AWS Lambda 함수로 S3에 업로드된 이미지를 처리하는 코드입니다.
// 이미지 처리 라이브러리인 sharp를 불러옵니다.
const sharp = require("sharp");
// AWS SDK의 S3 클라이언트와 명령어들을 불러옵니다.
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");

// S3 클라이언트 인스턴스를 생성합니다.
const s3 = new S3Client();

// event는 호출 상황에 대한 정보가 담겨 있고, context는 실행되는 함수 환경에 대한 정보가 담겨 있습니다. callback은 함수가 완료되었는지를 람다에게 알려줍니다.
exports.handler = async (event, context, callbak) => {
  // 이벤트 객체에서 S3 버킷 이름과 객체 키를 추출합니다.
  const Bucket = event.Records[0].s3.bucket.name;
  // 객체 키를 URL 디코딩하여 가져옵니다.
  const Key = decodeURIComponent(event.Records[0].s3.object.key);
  // 경로에서 파일 이름을 추출합니다.
  const filename = Key.split("/").at(-1);
  // 확장자를 소문자로 변환하여 추출합니다.
  const ext = Key.split(".").at(-1).toLowerCase();
  // 이미지 포맷이 jpg인 경우 jpeg로 변경합니다.
  const requiredFormat = ext === "jpg" ? "jpeg" : ext;
  console.log("name", filename, "ext", ext);

  try {
    // S3에서 원본 이미지를 가져옵니다.
    const getObject = await s3.send(new GetObjectCommand({ Bucket, Key }));
    // 스트림으로 전달되는 데이터를 버퍼에 쌓고 버퍼들을 하나로 결합하여 원본 이미지 버퍼를 만듭니다.
    const buffers = [];
    for await (const data of getObject.Body) {
      buffers.push(data);
    }
    const imageBuffer = Buffer.concat(buffers);
    console.log("put", imageBuffer.length);

    // sharp 라이브러리를 이용하여 이미지를 리사이즈하고 포맷을 변경한 후 버퍼로 변환하여 저장합니다.
    const resizedImage = await sharp(imageBuffer)
      // 가로와 세로를 각각 200픽셀로 조정하되, 원본 비율을 유지하면서 내부에 맞게 조정하는 옵션입니다.
      .resize(200, 200, { fit: "inside" })
      .toFormat(requiredFormat)
      .toBuffer();

    // 리사이징된 이미지를 s3의 thumb 폴더 아래에 저장합니다.
    await s3.send(
      new PutObjectCommand({
        Bucket,
        Key: `thumb/${filename}`,
        Body: resizedImage,
      })
    );
    console.log("put", resizedImage.length);

    // 성공 시 콜백으로 썸네일 경로를 반환합니다.
    // Callback의 첫 번째 인자는 에러 여부를 의미하고, 두 번째 인자는 설명을 의미합니다.
    return callbak(null, `thumb/${filename}`);
  } catch (error) {
    console.log(error);
    return callbak(error);
  }
};
