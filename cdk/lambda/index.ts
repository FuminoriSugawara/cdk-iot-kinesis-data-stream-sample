import { FirehoseTransformationEvent } from "aws-lambda/trigger/kinesis-firehose-transformation";

export const handler = async (event: FirehoseTransformationEvent) => {
  console.log({ event });
  event.records.forEach((record) => {
    console.log({ record });
  });
  return {
    records: event.records.map((record) => {
      return {
        recordId: record.recordId,
        result: "Ok",
        data: record.data,
      };
    }),
  };
};
