/*
 * Module courrielleur - cm2m2ssimo (envoi melanssimo depuis le courrielleur)
 * m2sMessage : Objet message mélanissimo
 */


const nsIDocumentEncoder=Components.interfaces.nsIDocumentEncoder;

/*
 * specifications du format du message melanissimo
 *
 */
const json_message='{"listeFichiers":[{"taille":0,"empreinte":"","nom":""}], \
                    "listeDestinatairesCc":[{"libellé":"","adresse":""}], \
                    "sujet":"","listeDestinatairesTo":[{"libellé":"","adresse":""}], \
                    "listeDestinatairesCci":[{"libellé":"","adresse":""}], \
                    "corpsMessage":"","expéditeur":{"libellé":"","adresse":""}}';


/**
 * Objet message mélanissimo
 * pour construction des éléments du message a partir du message thunderbird
*/
function m2sMessage(){

  this.Init();
}

m2sMessage.prototype={

  //liste des fichiers (tableau d'objets m2sFichier)
  _fichiers:null,

  //si true calcul md5 des fichiers (par defaut)
  _md5fichiers:true,

  get md5fichiers(){
    return this._md5fichiers;
  },

  set md5fichiers(bmd5){
    this._md5fichiers=bmd5;
  },

  //retourne le nombre de fichiers
  get NbFichier(){
    if (null==this._fichiers)
      return 0;
    return this._fichiers.length;
  },

  //retourne un fichier dans la liste
  GetFichier: function(index){
    
    if (null==this._fichiers){
      m2sTrace("m2sMessage GetFichier aucun fichier");
      return null;
    }
    
    if (index>=this._fichiers.length){
      m2sTrace("m2sMessage GetFichier index hors limites");
      return null;
    }
    
    return this._fichiers[index];
  },

  //taille des éléments du message
  _tailleMsg:0,

  //retourne la taille totale des éléments du message
  //sujet+corps+fichiers
  get tailleMsg(){
    return this._tailleMsg;
  },

  //objet message melassimo
  //au format json_message
  _message: null,

  //initialise _message
  initMessage: function(){

    this._message=null;

    this._message={
      listeFichiers:[],
      listeDestinatairesTo:[],
      listeDestinatairesCc:[],
      listeDestinatairesCci:[],
      sujet:"",
      corpsMessage:"",
      expéditeur:{}
    };
  },
  
  //objet _message
  get message(){

    return this._message;
  },

  //chaine JSON de l'objet _message
  get jsonMessage(){

    return JSON.stringify(this._message);
  },

  //donnees fenetre de composition
  //instance nsIMsgCompose
  _msgCompose: null,
  //instance nsIMsgIdentity de l'emetteur
  _identite: null,
  //identifiant du compte emetteur
  _accountKey: null,

  //initialisation de l'instance
  //qui peut etre obtenu avec la requete GET /service
  Init: function(){

    m2sTrace("m2sMessage Init");

    this.InitVariables();
  },

  /*construction du message a partir du message thunderbird
  * @param msgcompose instance nsIMsgCompose
  * @param msgtype aleur nsIMsgCompDeliverMode
  * @param identite instance nsIMsgIdentity – expéditeur du message
  * @param accountKey identifiant du compte de l'expéditeur
  * return objet message
  */
  CreateMessage: function(msgcompose, identite, accountKey){

    m2sTrace("m2sMessage CreateMessage");

    if (null==msgcompose)
      throw new m2sExeception("Le paramètre 'msgcompose' n'est pas valide",-1, "message.js", "CreateMessage");

    if (null==identite)
      throw new m2sExeception("Le paramètre 'identite' n'est pas valide",-1, "message.js", "CreateMessage");

    if (null==accountKey)
      throw new m2sExeception("L'idenfiant du compte émetteur n'est pas valide",-1, "message.js", "CreateMessage");

    this._msgCompose=msgcompose.QueryInterface(Components.interfaces.nsIMsgCompose);
    this._identite=identite.QueryInterface(Components.interfaces.nsIMsgIdentity);
    this._accountKey=accountKey;

    this.initMessage();

    //calcul taille du message
    this._tailleMsg=m2sTailleComposition(msgcompose);

    //traiter le sujet
    m2sTrace("m2sMessage CreateMessage - traiter le sujet du message");
    this.traiteSujet();

    //traiter l'emetteur
    m2sTrace("m2sMessage CreateMessage - traiter l'emetteur du message");
    this.traiteEmetteur();

    //traiter les destinataires To
    m2sTrace("m2sMessage CreateMessage - traiter les destinataires To");
    this.message.listeDestinatairesTo=this.traiteDestinataires(msgcompose.compFields.to);

    //traiter les destinataires Cc
    m2sTrace("m2sMessage CreateMessage - traiter les destinataires Cc");
    this.message.listeDestinatairesCc=this.traiteDestinataires(msgcompose.compFields.cc);

    //traiter les destinataires Cci
    m2sTrace("m2sMessage CreateMessage - traiter les destinataires Cci");
    this.message.listeDestinatairesCci=this.traiteDestinataires(msgcompose.compFields.bcc);

    //traiter le corps
    m2sTrace("m2sMessage CreateMessage - traiter le corps du message");
    this.traiteCorps();

    //traiter les pieces jointes
    m2sTrace("m2sMessage CreateMessage - traiter les pieces jointes");
    this.traiteListeFichiers();

    m2sTrace("m2sMessage CreateMessage fin");
    return this.message;
  },

  //met a jour les md5 des fichiers
  //cas ou md5 positionne a false lors de l'appel CreateMessage
  UpdateFichiersMd5: function(){

    m2sTrace("m2sMessage UpdateFichiersMd5");

    this.md5fichiers=true;

    let nb=this.message.listeFichiers.length;

    this.message.listeFichiers=[];

    for (var i=0;i<nb;i++){

      let fichier=this._fichiers[i];
      let md5=fichier.md5;

      let fic=new Object();
      fic.taille=fichier.taille;
      fic.empreinte=fichier.md5;
      fic.nom=fichier.nom;

      this.message.listeFichiers.push(fic);
    }
  },


  /* fonctions internes */
  InitVariables: function(){
    
    m2sTrace("m2sMessage InitVariables");
    this._fichiers=null;
    this._msgCompose=null;
    this._identite=null;
    this._accountKey=null;
    this._tailleMsg=0;
  },

  //initialisation de la liste des fichiers depuis CreateMessage
  //initialise this.message.listeFichiers avec this._fichiers
  //declenche une exception m2sExeception en cas d'erreur
  traiteListeFichiers: function(){

    this._fichiers=[];

    if (null==this._msgCompose){
      m2sTrace("m2sMessage traiteListeFichiers - aucun fichier dans le message!");
      return;
    }

    let attachments=this._msgCompose.compFields.attachments;
    while (attachments.hasMoreElements()){
      let attachment=attachments.getNext().QueryInterface(Components.interfaces.nsIMsgAttachment);

      let fichier=new m2sFichier();
      m2sTrace("m2sMessage traiteListeFichiers - fichier url:"+attachment.url);
      fichier.initWithAttachment(attachment);
      this._fichiers.push(fichier);
    }

    //les ajouter a this.message.listeFichiers
    for (var i=0;i<this._fichiers.length;i++){

      let fichier=this._fichiers[i];

      let fic=new Object();
      fic.taille=fichier.taille;
      fic.empreinte="";
      if (this.md5fichiers)
        fic.empreinte=fichier.md5;
      fic.nom=fichier.nom;

      m2sTrace("m2sMessage traiteListeFichiers - ajout du fichier:"+fichier.nom);
      this.message.listeFichiers.push(fic);
    }
  },

  _headerParser:null,

  get headerParser(){

    if (null==this._headerParser){
      this._headerParser=Components.classes["@mozilla.org/messenger/headerparser;1"].
                                    getService(Components.interfaces.nsIMsgHeaderParser);
    }

    return this._headerParser;
  },

  //traite l'emetteur
  //declenche une exception m2sExeception en cas d'erreur
  traiteEmetteur: function() {

    this.message.expéditeur.libellé="";
    this.message.expéditeur.adresse="";

    if (null==this._identite.email || ""==this._identite.email){
      m2sTrace("m2sMessage traiteEmetteur adresse de l'emetteur non definie");
      return;
    }

    if (null!=this._identite.fullName)
      this.message.expéditeur.libellé=this._identite.fullName;

    this.message.expéditeur.adresse=this._identite.email;

    m2sTrace("m2sMessage traiteEmetteur libellé:"+this.message.expéditeur.libellé+" - adresse:"+this.message.expéditeur.adresse);
  },

  //extrait le corps
  traiteCorps: function(){

    m2sTrace("m2sMessage traiteCorps");

    this.message.corpsMessage="";

    if (this._msgCompose.composeHTML) {
      
      m2sTrace("m2sMessage traiteCorps composeHTML");
      //traiter les images
      this.modifyHtmlImages();

      this.message.corpsMessage=this._msgCompose.editor.outputToString('text/html', nsIDocumentEncoder.OutputBodyOnly |
                                                                                    nsIDocumentEncoder.OutputNoScriptContent|
                                                                                     nsIDocumentEncoder.OutputCRLineBreak |
                                                                                     nsIDocumentEncoder.OutputLFLineBreak);
    } else {
      
      //idem nsMsgCompose::SendMsg
      this.message.corpsMessage=this._msgCompose.editor.outputToString('text/plain', nsIDocumentEncoder.OutputFormatted |
                                                                                     nsIDocumentEncoder.OutputCRLineBreak |
                                                                                     nsIDocumentEncoder.OutputLFLineBreak);
    }
  },

  //traite le sujet avec validation
  //declenche une exception m2sExeception en cas d'erreur
  traiteSujet: function(){

    this.message.sujet="";

    if (null!=this._msgCompose.compFields.subject)
      this.message.sujet=this._msgCompose.compFields.subject;
  },

  //traite un groupe de destinataires (To, Cc, Bcc) avec validation
  //declenche une exception m2sExeception en cas d'erreur
  // @param destinataires compFields.to|compFields.cc|compFields.bcc
  traiteDestinataires: function(destinataires) {

    let listeDests=[];

    let addrs={};
    let noms={};
    let complets={};

    this.headerParser.parseHeadersWithArray(destinataires, addrs, noms, complets);

    if (null==addrs) {
      m2sTrace("m2sMessage traiteDestinataires aucune adresse");
      return listeDests;
    }

    m2sTrace("m2sMessage traiteDestinataires addrs.value:"+addrs.value);

    for (var m in addrs.value){

      m2sTrace("m2sMessage traiteDestinataires addrs m:"+m+" - value:"+addrs.value[m]);

      let dest=new Object();
      dest.adresse=addrs.value[m];

      if (noms.value[m])
        dest.libellé=noms.value[m];
      else
        dest.libellé="";

      m2sTrace("m2sMessage traiteDestinataires adresse:'"+dest.adresse+"' - libellé:'"+dest.libellé+"'");

      listeDests.push(dest);
    }

    return listeDests;
  },

  //conversion des images html en base 64
  modifyHtmlImages: function(){

    try{

      let editorMail=this._msgCompose.editor.QueryInterface(Components.interfaces.nsIEditorMailSupport);

      let objets=editorMail.getEmbeddedObjects();
      let nb=objets.length;

      m2sTrace("m2sMessage modifyHtmlImages getEmbeddedObjects nombre:"+nb);
      for (var i=0;i<nb;i++){

        let obj=objets.QueryElementAt(i, Components.interfaces.nsIDOMElement);

        if (null==obj){
          m2sTrace("m2sMessage modifyHtmlImages obj==null i:"+i);
          continue;
        }

        let nosend=obj.getAttribute("moz-do-not-send");
        if ("true"==nosend) {
          m2sTrace("m2sMessage modifyHtmlImages moz-do-not-send==true i:"+i);
          continue;
        }

        if (!(obj instanceof Components.interfaces.nsIDOMHTMLImageElement)){
          m2sTrace("m2sMessage modifyHtmlImages pas une image i:"+i);
          continue;
        }

        let img=obj.QueryInterface(Components.interfaces.nsIDOMHTMLImageElement);

        if (img){
          m2sTrace("m2sMessage modifyHtmlImages getEmbeddedObjects image src:"+img.src);
          let datauri=this.getDataUriForImg(img);
          if (null!=datauri)
            img.src=datauri;
        }
      }
      
    } catch(ex) {
      m2sTrace("m2sMessage modifyHtmlImages exception:"+ex);
    }
  },

  getDataUriForImg: function(htmlimg){

    if (-1==htmlimg.src.indexOf("data:image/")){

      //code exemple: https://developer.mozilla.org/en-US/docs/Web/HTTP/data_URIs
      let fileHandler=Services.io.getProtocolHandler("file")
                                  .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
      let fichier=fileHandler.getFileFromURLSpec(htmlimg.src);

      //verifier existe et type fichier
      if (!fichier.exists()){
        m2sTrace("m2sMessage getDataUriForImg fichier image inexistant:"+htmlimg.src);
        return null;
      }
      
      let contentType=Components.classes["@mozilla.org/mime;1"]
                                .getService(Components.interfaces.nsIMIMEService)
                                .getTypeFromFile(fichier);
      let inputStream=Components.classes["@mozilla.org/network/file-input-stream;1"]
                                .createInstance(Components.interfaces.nsIFileInputStream);
      inputStream.init(fichier, 0x01, 0600, 0);

      let stream=Components.classes["@mozilla.org/binaryinputstream;1"]
                           .createInstance(Components.interfaces.nsIBinaryInputStream);
      stream.setInputStream(inputStream);

      let encoded=btoa(stream.readBytes(stream.available()));
      
      return "data:" + contentType + ";base64," + encoded;

    } else{
      m2sTrace("m2sMessage getDataUriForImg pas de conversion possible!");
      return null;
    }
  }
}
