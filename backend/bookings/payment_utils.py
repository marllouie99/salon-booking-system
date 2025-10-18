import paypalrestsdk
from django.conf import settings

# Configure PayPal SDK
def configure_paypal():
    paypalrestsdk.configure({
        "mode": settings.PAYPAL_MODE,
        "client_id": settings.PAYPAL_CLIENT_ID,
        "client_secret": settings.PAYPAL_CLIENT_SECRET
    })

def create_payment(amount, currency='USD', description='Salon Booking'):
    """Create a PayPal payment"""
    configure_paypal()
    
    payment = paypalrestsdk.Payment({
        "intent": "sale",
        "payer": {
            "payment_method": "paypal"
        },
        "redirect_urls": {
            "return_url": "http://localhost:3000/payment/success",
            "cancel_url": "http://localhost:3000/payment/cancel"
        },
        "transactions": [{
            "amount": {
                "total": str(amount),
                "currency": currency
            },
            "description": description
        }]
    })
    
    if payment.create():
        return {
            'success': True,
            'payment_id': payment.id,
            'approval_url': next((link.href for link in payment.links if link.rel == "approval_url"), None)
        }
    else:
        return {
            'success': False,
            'error': payment.error
        }

def execute_payment(payment_id, payer_id):
    """Execute/complete a PayPal payment"""
    configure_paypal()
    
    payment = paypalrestsdk.Payment.find(payment_id)
    
    if payment.execute({"payer_id": payer_id}):
        return {
            'success': True,
            'payment': payment
        }
    else:
        return {
            'success': False,
            'error': payment.error
        }

def refund_payment(sale_id, amount=None):
    """Refund a PayPal payment"""
    configure_paypal()
    
    sale = paypalrestsdk.Sale.find(sale_id)
    
    refund_data = {}
    if amount:
        refund_data = {
            "amount": {
                "total": str(amount),
                "currency": "USD"
            }
        }
    
    if sale.refund(refund_data):
        return {
            'success': True,
            'refund_id': sale.refund_id
        }
    else:
        return {
            'success': False,
            'error': sale.error
        }
