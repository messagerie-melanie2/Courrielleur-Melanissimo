/*
 * Module courrielleur - cm2m2ssimo (envoi melanssimo depuis le courrielleur)
 * m2sFichier
 */


/*
 *  Represente un fichier joint au message
 *  n'autorise pas l'initialisation avec un chemin de fichier inexistant => genere une exception
 *
 * chemin chemin complet du fichier
 * si md5sum true, calcul le md5
 */
function m2sFichier(chemin, md5sum) {

  if (chemin && ""!=chemin)
    this.init(chemin, md5sum);
}

m2sFichier.prototype={

  //chemin du fichier
  _chemin:null,

  //nom du fichier dans l'interface UI
  _nom: null,

  //instance nsILocalFile
  _fichier: null,

  get File(){
    return this._fichier;
  },

  //md5 calcule
  _md5:null,


  //initialisation avec chemin complet
  //si md5sum true, calcul le md5
  //genere une exception si le fichier n'existe pas
  init: function(chemin, md5sum){

    m2sTrace("m2sFichier init - chemin:"+chemin);

    this._chemin=null;
    this._md5=null;
    this._nom=null;
    this._fichier=null;

    if (null==chemin || ""==chemin) {
      //instance non initialisee
      m2sTrace("m2sFichier init - chemin de fichier non valide");
      throw new m2sExeception("Le fichier n'existe pas :"+chemin);
    }

    //initialisation _fichier
    this._fichier=Components.classes["@mozilla.org/file/local;1"] .createInstance(Components.interfaces.nsIFile);
    this._fichier.initWithPath(chemin);
    
    //verifier existe et type fichier
    if (!this._fichier.exists()){
      //n'existe pas
      m2sTrace("m2sFichier init - Le fichier n'existe pas:"+chemin);
      m2sEcritLog(M2S_LOGS_MODULE, "Le fichier n'existe pas", chemin);
      throw new m2sExeception("Le fichier n'existe pas :"+chemin);
    }

    if (!this._fichier.isFile()){
      //n'est pas un fichier
      m2sTrace("m2sFichier init - n'est pas un fichier:"+chemin);
      m2sEcritLog(M2S_LOGS_MODULE, "Le chemin n'est pas un fichier", chemin);
      throw new m2sExeception("N'est pas un fichier :"+chemin);
    }

    this._chemin=chemin;

    this._nom=this._fichier.leafName;

    this._md5=null;
    if (md5sum){
      //calculer le md5sum
      this.md5;
    }
  },

  //initialisation avec instance nsIMsgAttachment
  //si md5sum true, calcul le md5
  initWithAttachment: function(attachment, md5sum){

    m2sTrace("m2sFichier initWithAttachment - url:"+attachment.url);

    let fileHandler=Services.io.getProtocolHandler("file")
                               .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
    let fic=fileHandler.getFileFromURLSpec(attachment.url);

    this.init(fic.path, md5sum);
    this._nom=attachment.name;
  },

  //retourne le chemin complet
  get chemin(){
    return this._chemin;
  },

  //retourne le nom d'affichage du fichier
  get nom(){
    return this._nom;
  },

  //retourne le md5 du fichier, le calcule si nécessaire
  get md5() {

    if (null==this._md5 &&
        null!=this._fichier &&
        0<this.taille){
          
      m2sTrace("m2sFichier calcul md5 du fichier:"+this.chemin);
      
      //calculer le md5
      //model des sources https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsICryptoHash
      let istream=Components.classes["@mozilla.org/network/file-input-stream;1"]
                      .createInstance(Components.interfaces.nsIFileInputStream);
      // open for reading
      istream.init(this._fichier, 0x01, 0444, 0);
      let ch=Components.classes["@mozilla.org/security/hash;1"]
                        .createInstance(Components.interfaces.nsICryptoHash);
      // we want to use the MD5 algorithm
      ch.init(ch.MD5);
      // this tells updateFromStream to read the entire file
      const PR_UINT32_MAX = 0xffffffff;
      ch.updateFromStream(istream, PR_UINT32_MAX);
      // pass false here to get binary data back
      let hash = ch.finish(false);

      // return the two-digit hexadecimal code for a byte
      function toHexString(charCode) {
        return ("0" + charCode.toString(16)).slice(-2);
      }

      // convert the binary hash data to a hex string.
      let tab=[];
      for (var i in hash)
        tab.push(toHexString(hash.charCodeAt(i)));
      this._md5=tab.join("");

      // this._md5 now contains your hash in hex
      m2sTrace("m2sFichier md5 du fichier:"+this._md5);

    } else {
      m2sTrace("m2sFichier pas de calcul md5 du fichier:"+this.chemin);
    }
    return this._md5;
  },

  //retourne l'extension du fichier, null si aucune
  get ext() {

    if (null==this._fichier)
      return null;

    let nom=this.nom;
    let pos=nom.lastIndexOf(".");
    if (-1==pos)
      return "";

    return nom.substring(pos+1);
  },

  //retourne la taille
  get taille() {

    if (null==this._fichier)
      return 0;

    return this._fichier.fileSize;
  },

  //retourne les parametres de fichier au format json
  //pour les requetes d'envoi de fichiers
  //@param md5sum si true, ajoute le md5
  GetJsonParams: function(md5sum){

    if (null==this._fichier){
      m2sTrace("m2sFichier fichier non initialise");
      throw new m2sExeception("Aucun fichier (GetJsonParams)");
    }

    let params=new Object();
    params.taille=this.taille;
    if (md5sum)
      params.empreinte=this.md5;
    else
      params.empreinte=0;
    params.nom=this.nom;

    return JSON.stringify(params);
  }
}
