$(document).ready(function() {
	//Show form for paying invoice
    $("#pay_invoice").click(function() {
        $(this).hide(function() {
            $("#payment_form").slideToggle();
            $(".page-title").text("Invoice: Pay");
        });
    })
    //Show form for adding account flags
    $("#add_flag").click(function() {
        $("#add_flag").hide();
        $("#flag_form").slideToggle("fast");
    });
    if ($('#flags > *').length === 0) {
            $("#flags").height(0);
	
	}

    //Customer dashboard flags
    $(".close.flag").click(function() {
        if ($('#flags > *').length === 1) {
        	//Collapse height after all flags are closed
            $("#flags").height(0);
        }
    });

    $(".reply").click(function(){
        $("#ticket_reply").slideDown();
    })


});