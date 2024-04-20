import { Message, Stan } from "node-nats-streaming";
import { Subjects } from "./subjects";

interface Event {
  subject: Subjects;
  data: any;
}

export abstract class Listener<T extends Event> {
  abstract subject: T["subject"];
  abstract queueGroupName: string;
  abstract onMessage(data: T["data"], msg: Message): void;

  private client: Stan;

  protected ackWait = 5 * 1000;

  constructor(client: Stan) {
    this.client = client;
  }

  subscriptionOptions() {
    // Ack: Acknowledge. Amb setManualAck to true, hem de gestionar que confirmem que hem rebut l'event i ho fem perquè ho confirmarem un cop el processem, per si hi hagués un error imprevist, no es 'perdés' l'event. Si no confirmem, s'envia l'event a un altre listener del mateix qGroup.
    // setDeliverAllAvailable per quan reiniciem el listener, recuperar els events que han sigut enviats al passat
    // setDurableName, per no recuperar TOTS els events del passat, sinó només els "no processats" fins ara.
    return this.client
      .subscriptionOptions()
      .setManualAckMode(true)
      .setAckWait(this.ackWait)
      .setDeliverAllAvailable()
      .setDurableName(this.queueGroupName);
  }

  listen() {
    // Ens subcrivim a un tema i a un queue group. El queue group permet que tot i tenir varis listeners escoltant el mateix tema, només s'envia a un dels listeners, per evitar repetir events (si tenim còpies d'un mateix listener escoltant un mateix tema)
    const subscription = this.client.subscribe(
      this.subject,
      this.queueGroupName,
      this.subscriptionOptions()
    );

    subscription.on("message", (msg: Message) => {
      console.log(`Message received: ${this.subject} / ${this.queueGroupName}`);
      const parsedData = this.parseMessage(msg);
      this.onMessage(parsedData, msg);
    });
  }

  parseMessage(msg: Message) {
    const data = msg.getData();

    return typeof data === "string"
      ? JSON.parse(data)
      : JSON.parse(data.toString("utf8"));
  }
}
