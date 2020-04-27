import {createSchema, ExtractDoc, ExtractProps, Type, typedModel} from 'ts-mongoose';

// NOT BEING USED YET
const GoLinkSchema = createSchema(
  {
    goLink: Type.string({required: true, alias: "linkname"}), // `linkname`
    goDest: Type.string({required: true, alias: "dest"}), // `dest`
    owner: Type.string({required: true, alias: "author"}), // `author`
    hasQrCode: Type.boolean({required: false}),
    caption: Type.string({required: false}),
    addLogo: Type.boolean({required: false}),
    createdTime: Type.date({required: true}),
    updateTime: Type.date({required:true, alias: "updateTimed"}),
  }
);
export const GoLink = typedModel('GoLink', GoLinkSchema, 'shortlinks'/*collection name*/);
export type GoLinkDoc = ExtractDoc<typeof GoLinkSchema>;
export type GoLinkProps = ExtractProps<typeof GoLinkSchema>;
