/**
 * Invocable action — sends a Pronto Eats web-push notification.
 *
 * Usable from any Flow ("Send Pronto Push Notification"). It targets either a
 * single Contact or every active subscriber (broadcast), then calls the Pronto
 * Eats push backend on Heroku, which signs and delivers the push to each
 * subscribed device. The endpoint URL and shared secret come from the
 * Push_Endpoint_URL / Push_Shared_Secret custom labels (no secrets in code;
 * the label file is gitignored so the secret never reaches source control).
 */
public with sharing class PushNotificationAction {

    public class Request {
        @InvocableVariable(label='Contact Id' description='Target a single contact. Leave blank when broadcasting.')
        public String contactId;

        @InvocableVariable(label='Broadcast to all subscribers' description='If true, notify every active subscriber instead of one contact.')
        public Boolean broadcastToAll = false;

        @InvocableVariable(label='Title' required=true description='Notification title.')
        public String title;

        @InvocableVariable(label='Message' description='Notification body text.')
        public String message;

        @InvocableVariable(label='Open URL' description='Path or URL opened when the notification is tapped (defaults to /).')
        public String url;
    }

    public class Result {
        @InvocableVariable(label='Status') public String status;
        @InvocableVariable(label='Devices sent') public Integer sent;
        @InvocableVariable(label='Devices targeted') public Integer targeted;
    }

    @InvocableMethod(label='Send Pronto Push Notification'
        description='Sends a web push to a contact or all subscribers via the Pronto Eats app.'
        callout=true)
    public static List<Result> send(List<Request> requests) {
        List<Result> results = new List<Result>();
        String endpointBase = System.Label.Push_Endpoint_URL;
        String sharedSecret = System.Label.Push_Shared_Secret;

        for (Request req : requests) {
            Result r = new Result();
            try {
                if (String.isBlank(endpointBase)) {
                    r.status = 'Push config: the Push_Endpoint_URL custom label is empty.';
                    results.add(r);
                    continue;
                }
                if (String.isBlank(req.title)) {
                    r.status = 'Title is required.';
                    results.add(r);
                    continue;
                }

                Map<String, Object> payload = new Map<String, Object>{
                    'title' => req.title,
                    'body'  => req.message,
                    'url'   => String.isBlank(req.url) ? '/' : req.url
                };
                if (req.broadcastToAll == true) {
                    payload.put('all', true);
                } else {
                    payload.put('contactId', req.contactId);
                }

                HttpRequest httpReq = new HttpRequest();
                httpReq.setEndpoint(endpointBase.removeEnd('/') + '/api/push/send');
                httpReq.setMethod('POST');
                httpReq.setHeader('Content-Type', 'application/json');
                httpReq.setHeader('X-Push-Secret', sharedSecret);
                httpReq.setBody(JSON.serialize(payload));
                httpReq.setTimeout(120000);

                HttpResponse resp = new Http().send(httpReq);
                Integer code = resp.getStatusCode();
                if (code == 200) {
                    Map<String, Object> data = (Map<String, Object>) JSON.deserializeUntyped(resp.getBody());
                    r.status   = 'OK';
                    r.sent     = data.get('sent') == null ? 0 : Integer.valueOf(data.get('sent'));
                    r.targeted = data.get('targeted') == null ? 0 : Integer.valueOf(data.get('targeted'));
                } else {
                    r.status = 'HTTP ' + code + ': ' + resp.getBody();
                }
            } catch (Exception e) {
                r.status = 'Error: ' + e.getMessage();
            }
            results.add(r);
        }
        return results;
    }
}
