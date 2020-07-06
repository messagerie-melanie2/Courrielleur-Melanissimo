/* Copie dans elements envoyes du message melanissimo */


ChromeUtils.import("resource:///modules/mailServices.js");
ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource:///modules/MailUtils.js");


// ecouteur:
// onCopieErreur(code)
// onCopieSucces
function CopieEnvoiM2ssimo(ecouteur){

  this.ecouteur=ecouteur;

}

CopieEnvoiM2ssimo.prototype={

  ecouteur: null,
  
  msgwindow:null,

  draftFolderURI: null,

  fccFolderURI: null,
  
  itemBrouillon:null,

  CopieMessage: function(msgcompose, identite, compte, msgwindow, progress){
    
    m2sTrace("CopieEnvoiM2ssimo CopieMessage");
    
    this.msgwindow=msgwindow;
   
    // liste des pieces jointes
    let attachments=msgcompose.compFields.attachments;
    let attachmentsNames=[];
    while (attachments.hasMoreElements()){
      let attachment=attachments.getNext().QueryInterface(Components.interfaces.nsIMsgAttachment);
      attachmentsNames.push(attachment.name);
    }

    // retirer pieces jointes
    msgcompose.compFields.removeAttachments();

    // ajouter information dans le corps
    msgcompose.editor.endOfDocument();
    let textEditor=msgcompose.editor.QueryInterface(Components.interfaces.nsIPlaintextEditor);
    let msgtxt=m2sMessageFromName("m2sEnvoiMelTxt");
    textEditor.insertText(msgtxt);
    
    // ajouter liste des pieces jointes
    msgtxt="";
    for (var j=0; j<attachmentsNames.length; j++)
      msgtxt+=attachmentsNames[j]+"\n";
    textEditor.insertText(msgtxt);

    this.draftFolderURI=identite.draftFolder;
    this.fccFolderURI=identite.fccFolder;

    let draftFolder=MailUtils.getFolderForURI(this.draftFolderURI);
    draftFolder.createStorageIfMissing(null);
    let fccFolder=MailUtils.getFolderForURI(this.fccFolderURI);
    fccFolder.createStorageIfMissing(null);

    // ajout listener
    let nsIFolderListener=Components.interfaces.nsIFolderListener;
    let notifyFlags=nsIFolderListener.added;//|nsIFolderListener.event
    MailServices.mailSession.AddFolderListener(this, notifyFlags);
    
    let cm2progress=Components.classes["@mozilla.org/messenger/progress;1"]
                              .createInstance(Components.interfaces.nsIMsgProgress);
    cm2progress.registerListener(this);

    // enregistrement dans brouillons
    m2sTrace("CopieEnvoiM2ssimo CopieMessage appel SendMsg");
    msgcompose.SendMsg(Components.interfaces.nsIMsgCompDeliverMode.SaveAsDraft, identite, compte, msgwindow, cm2progress);
  },

  // deplacement de brouillons vers éléments envoyés
  DeplaceBrouillon: function(msghdr){
    
    m2sTrace("CopieEnvoiM2ssimo DeplaceBrouillon");

    let msgs=Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray);
    msgs.appendElement(msghdr, false);

    let draftFolder=MailUtils.getFolderForURI(this.draftFolderURI);
    let fccFolder=MailUtils.getFolderForURI(this.fccFolderURI);

    MailServices.copy.CopyMessages(draftFolder, msgs, fccFolder, true, this, this.msgwindow, false);
  },

  /* nsIFolderListener */
  OnItemAdded: function(parentItem, item) {

    if (!(parentItem instanceof Components.interfaces.nsIMsgFolder))
      return;

    if (null==item || !(item instanceof Components.interfaces.nsIMsgDBHdr))
      return;

    if (this.draftFolderURI==parentItem.URI){

      MailServices.mailSession.RemoveFolderListener(this);

      this.itemBrouillon=item;
    }
  },

  OnItemRemoved: function(parentItem, item) { },
  OnItemPropertyChanged: function(item, property, oldValue, newValue) { },
  OnItemIntPropertyChanged: function(item, property, oldValue, newValue) {  },
  OnItemBoolPropertyChanged: function(item, property, oldValue, newValue) { },
  OnItemUnicharPropertyChanged: function(item, property, oldValue, newValue) { },
  OnItemPropertyFlagChanged: function(item, property, oldFlag, newFlag) { },
  OnItemEvent: function(folder, event) { },


  // nsIMsgCopyServiceListener
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey) {},
  GetMessageId: function() {},
  OnStopCopy: function(aStatus) {

    if (null!=this.ecouteur){

      if (Components.isSuccessCode(aStatus))
        this.ecouteur.onCopieSucces();
      else
        this.ecouteur.onCopieErreur(aStatus);
    }
  },
  
  // nsIWebProgressListener
  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus){

    if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP)
      this.DeplaceBrouillon(this.itemBrouillon);
  },

  onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress){},

  onLocationChange: function(aWebProgress, aRequest, aLocation, aFlags){},

  onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage){},

  onSecurityChange: function(aWebProgress, aRequest, state){},

  QueryInterface : function(iid){
    if (iid.equals(Components.interfaces.nsIWebProgressListener) ||
        iid.equals(Components.interfaces.nsISupportsWeakReference) ||
        iid.equals(Components.interfaces.nsISupports))
      return this;

    throw Components.results.NS_NOINTERFACE;
  }
}
